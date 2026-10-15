package com.visionbox.modules.fiscal;

import com.visionbox.modules.fiscal.dto.NfceCancelarRequest;
import com.visionbox.modules.fiscal.dto.NfceCancelarResponse;
import com.visionbox.modules.fiscal.dto.NfceEmitirRequest;
import com.visionbox.modules.fiscal.dto.NfceEmitirResponse;
import com.visionbox.modules.fiscal.repository.DocumentoFiscalRepository;
import com.visionbox.modules.pessoa.domain.Loja;
import com.visionbox.modules.pessoa.repository.LojaRepository;
import com.visionbox.shared.error.BusinessException;
import com.visionbox.shared.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

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

        String xmlAssinado = xmlDaRequisicao(req, serie, numero);

        FiscalProvider.ResultadoFiscal resultado = fiscalProvider.emitir(doc, xmlAssinado, req);

        // cStat 539 = "Duplicidade de NF-e com diferença na chave": o (CNPJ, modelo, série, número)
        // já existe na SEFAZ, usado por OUTRO sistema — a UF não divulga o histórico de numeração,
        // como aconteceu na série 090 (n. 3 e 4 de setembro/2026). Número veio automático e nada
        // foi autorizado nesta tentativa → pula para o próximo e reemite. A linha só grava o
        // resultado final, então o número pulado nunca vira documento.
        int pulos539 = 0;
        while (!resultado.autorizado() && "539".equals(resultado.codigoStatus())
                && req.getNumero() == null && pulos539 < MAX_PULOS_539) {
            pulos539++;
            numero = numero + 1;
            doc.setNumero(numero);
            xmlAssinado = xmlDaRequisicao(req, serie, numero);
            resultado = fiscalProvider.emitir(doc, xmlAssinado, req);
            log.warn("cStat 539 na emissao loja={} modelo={} serie={}: numero {} ja usado por outro "
                            + "sistema na SEFAZ; reemitindo com {} (pulo {}/{})",
                    lojaId, modelo, serie, numero - 1, numero, pulos539, MAX_PULOS_539);
        }

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

    /** Máximo de números pulados por cStat 539 numa única emissão (histórico alheio na série). */
    private static final int MAX_PULOS_539 = 5;

    /**
     * XML registrado em {@code xmlEnviado} quando o chamador não envia um: o XML que chega à SEFAZ
     * é montado pelo Flowbox a partir de série/número do payload, então este rascunho é refeto a
     * cada pulo de número do cStat 539.
     */
    private String xmlDaRequisicao(NfceEmitirRequest req, String serie, Integer numero) {
        return req.getXmlAssinado() != null
                ? req.getXmlAssinado()
                : "<NFe><infNFe versao=\"4.00\"><ide><serie>" + serie + "</serie><nNF>" + numero
                        + "</nNF></ide></infNFe></NFe>";
    }

    /**
     * Cancela uma NFC-e autorizada desta loja (evento 110111 via Flowbox).
     *
     * <p>Regras tiradas da SEFAZ e do OUTBOX ERP, não inventadas: só se cancela documento
     * AUTORIZADO, o evento exige o protocolo de autorização e a justificativa tem 15..255
     * caracteres. Rejeição do evento NÃO altera o documento — ele continua AUTORIZADO na SEFAZ.
     */
    @Transactional
    public NfceCancelarResponse cancelarNfce(NfceCancelarRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        String chave = req.getChaveAcesso().trim();

        DocumentoFiscal doc = repository.findByChaveAcessoAndLojaId(chave, lojaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "NFC-e com a chave " + chave + " não encontrada nesta loja. Confira a chave antes de cancelar."));

        if (doc.getStatus() != DocumentoFiscal.StatusFiscal.AUTORIZADO) {
            throw new BusinessException("Cancelamento exige documento AUTORIZADO; este documento está "
                    + doc.getStatus() + " (série " + doc.getSerie() + ", nº " + doc.getNumero() + ").");
        }

        String protocolo = doc.getProtocolo();
        if (!StringUtils.hasText(protocolo)) {
            // Autorizado fora do VisionBox ou registro perdido (ex.: 409 de outrora): o protocolo é
            // obrigatório no evento, então busca na fonte (Flowbox) antes de recusar.
            protocolo = fiscalProvider.consultar(chave).map(FiscalProvider.ResultadoFiscal::protocolo).orElse(null);
            if (StringUtils.hasText(protocolo)) {
                doc.setProtocolo(protocolo);
            }
        }
        if (!StringUtils.hasText(protocolo)) {
            throw new BusinessException("Documento sem protocolo de autorização registrado — a SEFAZ exige o "
                    + "protocolo no evento de cancelamento (cStat 274 sem ele). Chave " + chave + ".");
        }

        FiscalProvider.ResultadoFiscal resultado = fiscalProvider.cancelar(doc, req.getJustificativa().trim());

        NfceCancelarResponse.NfceCancelarResponseBuilder resp = NfceCancelarResponse.builder()
                .chaveAcesso(doc.getChaveAcesso())
                .serie(doc.getSerie())
                .numero(doc.getNumero())
                .protocoloEvento(resultado.protocolo())
                .codigoStatus(resultado.codigoStatus())
                .motivo(resultado.motivo());

        if (resultado.autorizado()) {
            doc.setStatus(DocumentoFiscal.StatusFiscal.CANCELADO);
            doc.setCodigoStatus(resultado.codigoStatus());
            doc.setMotivo(limitarMotivo(resultado.motivo()));
            repository.save(doc);
            resp.status(doc.getStatus().name()).cancelado(true);
        } else {
            // A SEFAZ rejeitou o evento: o documento segue AUTORIZADO (ex.: cStat 501 de prazo).
            resp.status(doc.getStatus().name()).cancelado(false);
            log.warn("Cancelamento rejeitado loja={} serie={} numero={} chave={} cStat={} motivo={}",
                    lojaId, doc.getSerie(), doc.getNumero(), chave, resultado.codigoStatus(), resultado.motivo());
        }

        log.info("Cancelamento NFC-e loja={} serie={} numero={} chave={} cancelado={} cStat={}",
                lojaId, doc.getSerie(), doc.getNumero(), chave, resultado.autorizado(), resultado.codigoStatus());
        return resp.build();
    }

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
     * Devolve o código gravado em {@code documento_fiscal.ambiente} (varchar(1)): 1 produção, 2 homologação.
     */
    private String ambienteDe(Loja loja, String ambienteRequisicao) {
        String bruto = null;
        if (loja != null && StringUtils.hasText(loja.getFiscalAmbiente())) {
            bruto = loja.getFiscalAmbiente().trim();
        } else if (StringUtils.hasText(ambienteRequisicao)) {
            bruto = ambienteRequisicao.trim();
        }
        if (bruto == null) {
            return "2";
        }
        if ("PRODUCAO".equalsIgnoreCase(bruto) || "1".equals(bruto)) {
            return "1";
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
        Integer maior = repository.maiorNumeroDaSerie(lojaId, modelo, serie, ambiente).orElse(null);
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
