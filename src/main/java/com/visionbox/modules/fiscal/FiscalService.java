package com.visionbox.modules.fiscal;

import com.visionbox.modules.fiscal.dto.NfceEmitirRequest;
import com.visionbox.modules.fiscal.dto.NfceEmitirResponse;
import com.visionbox.modules.fiscal.repository.DocumentoFiscalRepository;
import com.visionbox.modules.pessoa.domain.Loja;
import com.visionbox.modules.pessoa.repository.LojaRepository;
import com.visionbox.shared.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.OffsetDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class FiscalService {

    private final FiscalProvider fiscalProvider;
    private final DocumentoFiscalRepository repository;
    private final LojaRepository lojaRepository;

    @Transactional
    public NfceEmitirResponse emitirNfce(NfceEmitirRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();

        Loja loja = lojaRepository.findById(lojaId).orElse(null);
        DocumentoFiscal.ModeloFiscal modelo = parseModelo(req.getModelo());
        boolean nfce = modelo == DocumentoFiscal.ModeloFiscal.NFCE_65;

        // Série, ambiente e número inicial vêm da configuração fiscal da loja (Painel Fiscal, V48);
        // a requisição só entra quando a loja não definiu o seu.
        String serie = normalizarSerie(serieDe(loja, nfce, req.getSerie()));
        String ambiente = ambienteDe(loja, req.getAmbiente());

        Integer numero = req.getNumero();
        if (numero == null) {
            // Sequência por série + ambiente: maior número já usado + 1. Substitui o aleatório
            // 1..999999, que arriscava duplicidade de (CNPJ, modelo, série, número) na SEFAZ.
            numero = proximoNumero(lojaId, modelo, serie, ambiente, loja, nfce);
            int tentativas = 0;
            while (tentativas < 5
                    && repository.findByLojaIdAndModeloAndSerieAndNumero(lojaId, modelo, serie, numero).isPresent()) {
                numero = numero + 1;
                tentativas++;
            }
        }
        String tpEmis = "1"; // normal

        UUID osId = req.getOrdemServicoId();
        if (osId == null && req.getPedidoId() != null) {
            osId = req.getPedidoId();
        }

        DocumentoFiscal doc = DocumentoFiscal.builder()
                .lojaId(lojaId)
                .modelo(modelo)
                .serie(serie)
                .numero(numero)
                .chaveAcesso(req.getChaveAcesso())
                .status(DocumentoFiscal.StatusFiscal.PENDENTE)
                .ambiente(ambiente)
                .tpEmis(tpEmis)
                .pedidoId(req.getPedidoId())
                .ordemServicoId(osId)
                .dhEmissao(OffsetDateTime.now())
                .build();
        // prePersist will set dhEmissao if null
        doc = repository.save(doc);

        String xmlAssinado = req.getXmlAssinado() != null ? req.getXmlAssinado() : "<NFe><infNFe versao=\"4.00\"><ide><serie>" + serie + "</serie><nNF>" + numero + "</nNF></ide></infNFe></NFe>";

        FiscalProvider.ResultadoFiscal resultado = fiscalProvider.emitir(doc, xmlAssinado, req);

        // Persistir retorno do provider de forma generica; o mock tambem pode mutar doc.
        doc.setXmlEnviado(xmlAssinado);
        if (resultado.chaveAcesso() != null) doc.setChaveAcesso(resultado.chaveAcesso());
        if (resultado.protocolo() != null) doc.setProtocolo(resultado.protocolo());
        if (resultado.xmlRetorno() != null) doc.setXmlRetorno(resultado.xmlRetorno());
        if (resultado.dhAutorizacao() != null) doc.setDhAutorizacao(resultado.dhAutorizacao());
        if (resultado.autorizado()) {
            doc.setStatus(DocumentoFiscal.StatusFiscal.AUTORIZADO);
        } else {
            doc.setStatus(DocumentoFiscal.StatusFiscal.REJEITADO);
        }
        doc.setCodigoStatus(resultado.codigoStatus());
        doc.setMotivo(limitarMotivo(resultado.motivo()));
        doc = repository.save(doc);

        log.info("NFC-e emitida loja={} modelo={} serie={} numero={} chave={} protocolo={} status={}",
                lojaId, modelo, serie, numero, resultado.chaveAcesso(), resultado.protocolo(), doc.getStatus());

        return NfceEmitirResponse.builder()
                .id(doc.getId())
                .lojaId(lojaId)
                .modelo(doc.getModelo().name())
                .serie(doc.getSerie())
                .numero(doc.getNumero())
                .chaveAcesso(resultado.chaveAcesso())
                .protocolo(resultado.protocolo())
                .status(doc.getStatus().name())
                .codigoStatus(resultado.codigoStatus())
                .motivo(limitarMotivo(resultado.motivo()))
                .xmlRetorno(resultado.xmlRetorno())
                .dhAutorizacao(resultado.dhAutorizacao())
                .dhEmissao(doc.getDhEmissao())
                .ambiente(doc.getAmbiente())
                .tpEmis(doc.getTpEmis())
                .autorizado(resultado.autorizado())
                .build();
    }

    /** Teto do motivo persistido: o Flowbox devolve o corpo HTTP inteiro, que pode passar de 100 kB. */
    private static final int MOTIVO_MAXIMO = 2000;

    private static String limitarMotivo(String motivo) {
        if (motivo == null) return null;
        return motivo.length() <= MOTIVO_MAXIMO ? motivo : motivo.substring(0, MOTIVO_MAXIMO) + " ...";
    }

    /**
     * Série configurada no Painel Fiscal; a requisição só vale quando a loja não definiu a sua.
     * Série em branco cai para "1".
     */
    private String serieDe(Loja loja, boolean nfce, String serieRequisicao) {
        String configurada = loja != null ? (nfce ? loja.getFiscalSerieNfce() : loja.getFiscalSerieNfe()) : null;
        if (StringUtils.hasText(configurada)) {
            return configurada.trim();
        }
        return StringUtils.hasText(serieRequisicao) ? serieRequisicao.trim() : "1";
    }

    /** Série no formato do banco (001..999). O Flowbox remove o zero à esquerda no XML (XSD TSerie). */
    private String normalizarSerie(String serie) {
        if (serie == null || serie.isBlank()) {
            return "001";
        }
        String limpa = serie.trim();
        return limpa.matches("\\d{1,3}") ? String.format("%03d", Integer.parseInt(limpa)) : limpa;
    }

    /**
     * Ambiente da SEFAZ vem da configuração fiscal da loja (Painel Fiscal): a mesma fonte que o
     * provedor usa ao montar o payload. A requisição só vale quando a loja não definiu o seu.
     */
    private String ambienteDe(Loja loja, String ambienteRequisicao) {
        if (loja != null && StringUtils.hasText(loja.getFiscalAmbiente())) {
            return loja.getFiscalAmbiente().trim().toUpperCase();
        }
        if (StringUtils.hasText(ambienteRequisicao)) {
            return ambienteRequisicao.trim();
        }
        return "2";
    }

    /**
     * Próximo número livre da série: o maior número já usado na mesma série e mesmo ambiente + 1,
     * ou o número inicial configurado na loja quando a série ainda não tem documentos.
     * É a mesma estratégia do {@code ultimo_numero_nfce} do OUTBOX ERP — evita duplicidade de
     * (CNPJ, modelo, série, número), que a SEFAZ rejeita. Limite XSD TNF: 1..999999999.
     */
    private Integer proximoNumero(UUID lojaId, DocumentoFiscal.ModeloFiscal modelo, String serie,
                                  String ambiente, Loja loja, boolean nfce) {
        Integer maior = repository
                .findTopByLojaIdAndModeloAndSerieAndAmbienteOrderByNumeroDesc(lojaId, modelo, serie, ambiente)
                .orElse(null);
        if (maior != null) {
            if (maior >= 999_999_999) {
                throw new IllegalStateException("Número da série " + serie + " esgotado: máximo 999999999 (XSD TNF). "
                        + "Configure outra série no Painel Fiscal.");
            }
            return maior + 1;
        }
        Integer inicial = loja != null
                ? (nfce ? loja.getFiscalNumeroInicialNfce() : loja.getFiscalNumeroInicialNfe())
                : null;
        return inicial != null && inicial > 0 ? inicial : 1;
    }

    private DocumentoFiscal.ModeloFiscal parseModelo(String m) {
        if (m == null || m.isBlank()) return DocumentoFiscal.ModeloFiscal.NFCE_65;
        String s = m.trim().toUpperCase();
        if (s.contains("55") || s.equals("NFE")) return DocumentoFiscal.ModeloFiscal.NFE_55;
        return DocumentoFiscal.ModeloFiscal.NFCE_65;
    }
}
