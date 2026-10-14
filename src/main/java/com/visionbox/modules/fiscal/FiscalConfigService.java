package com.visionbox.modules.fiscal;

import com.visionbox.modules.fiscal.dto.FiscalConfigRequest;
import com.visionbox.modules.fiscal.dto.FiscalConfigResponse;
import com.visionbox.modules.fiscal.dto.TestarConexaoResponse;
import com.visionbox.modules.pessoa.domain.Loja;
import com.visionbox.modules.pessoa.repository.LojaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;

@Slf4j
@Service
@RequiredArgsConstructor
public class FiscalConfigService {

    private final LojaRepository lojaRepository;
    private final FiscalProvider fiscalProvider;

    @Value("${visionbox.fiscal.flowbox.url:http://localhost:8085}")
    private String defaultFlowboxUrl;

    @Value("${visionbox.fiscal.flowbox.api-key:flowbox_dev_key}")
    private String defaultFlowboxApiKey;

    /** Certificado A1 padrão no Flowbox quando a loja não define o seu. */
    @Value("${visionbox.fiscal.flowbox.certificado-id:1}")
    private Long defaultFlowboxCertificadoId;

    @Transactional(readOnly = true)
    public FiscalConfigResponse buscarConfig(UUID lojaId) {
        Loja loja = lojaRepository.findById(lojaId).orElse(null);

        String url = (loja != null && StringUtils.hasText(loja.getFlowboxUrl()))
                ? loja.getFlowboxUrl()
                : defaultFlowboxUrl;

        String apiKey = (loja != null && StringUtils.hasText(loja.getFlowboxApiKey()))
                ? loja.getFlowboxApiKey()
                : defaultFlowboxApiKey;

        String webUrl = (loja != null && StringUtils.hasText(loja.getFlowboxWebUrl()))
                ? loja.getFlowboxWebUrl()
                : "";

        Long certificadoId = (loja != null && loja.getFlowboxCertificadoId() != null)
                ? loja.getFlowboxCertificadoId()
                : defaultFlowboxCertificadoId;

        boolean isFlowbox = fiscalProvider instanceof FlowboxFiscalProvider;

        return FiscalConfigResponse.builder()
                .flowboxUrl(url)
                .flowboxApiKey(apiKey)
                .flowboxWebUrl(webUrl)
                .flowboxCertificadoId(certificadoId)
                .inscricaoEstadual(loja != null ? loja.getInscricaoEstadual() : null)
                .csc(loja != null ? loja.getCsc() : null)
                .cscId(loja != null ? loja.getCscId() : null)
                .codigoMunicipio(loja != null ? loja.getCodigoMunicipio() : null)
                .crt(loja != null ? loja.getCrt() : null)
                .fiscalAmbiente(loja != null ? loja.getFiscalAmbiente() : null)
                .fiscalSerieNfce(loja != null ? loja.getFiscalSerieNfce() : null)
                .fiscalSerieNfe(loja != null ? loja.getFiscalSerieNfe() : null)
                .fiscalNumeroInicialNfce(loja != null ? loja.getFiscalNumeroInicialNfce() : null)
                .fiscalNumeroInicialNfe(loja != null ? loja.getFiscalNumeroInicialNfe() : null)
                .fiscalProvider(isFlowbox ? "flowbox" : "mock")
                .active(isFlowbox)
                .build();
    }

    @Transactional
    public FiscalConfigResponse salvarConfig(UUID lojaId, FiscalConfigRequest request) {
        Loja loja = lojaRepository.findById(lojaId)
                .orElseThrow(() -> new IllegalArgumentException("Loja não encontrada: " + lojaId));

        if (request.getFlowboxUrl() != null) {
            loja.setFlowboxUrl(request.getFlowboxUrl().trim());
        }
        if (request.getFlowboxApiKey() != null) {
            loja.setFlowboxApiKey(request.getFlowboxApiKey().trim());
        }
        if (request.getFlowboxWebUrl() != null) {
            loja.setFlowboxWebUrl(request.getFlowboxWebUrl().trim());
        }
        // null preserva o valor atual; 0 limpa e volta ao certificado padrão da aplicação.
        if (request.getFlowboxCertificadoId() != null) {
            loja.setFlowboxCertificadoId(request.getFlowboxCertificadoId() > 0
                    ? request.getFlowboxCertificadoId() : null);
        }

        // Cadastro fiscal do emitente: null preserva, string vazia limpa.
        aplicarTexto(loja::setInscricaoEstadual, request.getInscricaoEstadual());
        aplicarTexto(loja::setCsc, request.getCsc());
        aplicarTexto(loja::setCscId, request.getCscId());
        aplicarTexto(loja::setCodigoMunicipio, request.getCodigoMunicipio());
        aplicarTexto(loja::setCrt, request.getCrt());
        aplicarTexto(loja::setFiscalAmbiente, request.getFiscalAmbiente());

        // Série e número inicial da NFC-e/NF-e (V48): null preserva, string vazia limpa.
        // A série é normalizada para 001..999 no momento do envio, e não a que já está gravada.
        aplicarTexto(loja::setFiscalSerieNfce, normalizarParaGravar(request.getFiscalSerieNfce(), "NFC-e"));
        aplicarTexto(loja::setFiscalSerieNfe, normalizarParaGravar(request.getFiscalSerieNfe(), "NF-e"));
        aplicarNumeroInicial(loja::setFiscalNumeroInicialNfce, request.getFiscalNumeroInicialNfce(), "NFC-e");
        aplicarNumeroInicial(loja::setFiscalNumeroInicialNfe, request.getFiscalNumeroInicialNfe(), "NF-e");

        if (loja.getCrt() != null && !Set.of("1", "2", "3").contains(loja.getCrt())) {
            throw new IllegalArgumentException("CRT inválido: use 1 (Simples Nacional), 2 (Lucro Presumido) ou 3 (Lucro Real).");
        }
        if (loja.getFiscalAmbiente() != null
                && !Set.of("HOMOLOGACAO", "PRODUCAO").contains(loja.getFiscalAmbiente().toUpperCase())) {
            throw new IllegalArgumentException("Ambiente fiscal inválido: use HOMOLOGACAO ou PRODUCAO.");
        }
        if (loja.getCodigoMunicipio() != null && !loja.getCodigoMunicipio().matches("\\d{7}")) {
            throw new IllegalArgumentException("Código do município (IBGE) deve ter exatamente 7 dígitos.");
        }

        lojaRepository.save(loja);
        log.info("Configuração fiscal atualizada para a loja {}: flowboxUrl={} certificadoId={} ambiente={} crt={} ieCadastrada={}",
                lojaId, loja.getFlowboxUrl(), loja.getFlowboxCertificadoId(), loja.getFiscalAmbiente(),
                loja.getCrt(), loja.getInscricaoEstadual() != null);

        return buscarConfig(lojaId);
    }

    /** Null preserva o valor atual; string vazia (ou só em branco) limpa o campo. */
    private void aplicarTexto(Consumer<String> setter, String novo) {
        if (novo == null) {
            return;
        }
        String limpo = novo.trim();
        setter.accept(limpo.isEmpty() ? null : limpo);
    }

    /**
     * Devolve a série no formato do banco (001..999) ou o próprio valor quando veio nulo/em branco,
     * para {@link #aplicarTexto} decidir preservar ou limpar. Valida contra o tipo {@code TSerie}
     * do XSD oficial da SEFAZ: {@code 0|[1-9][0-9]{0,2}} — 0 a 999, sem zero à esquerda.
     * O zero à esquerda só existe na chave de acesso; no XML a série sai como 1..999.
     */
    private String normalizarParaGravar(String valor, String modelo) {
        if (valor == null || valor.trim().isEmpty()) {
            return valor;
        }
        String limpo = valor.trim();
        if (!limpo.matches("\\d{1,3}")) {
            throw new IllegalArgumentException(
                    "Série da " + modelo + " inválida: use 1 a 3 dígitos (XSD TSerie aceita 0 a 999).");
        }
        int numero = Integer.parseInt(limpo);
        if (numero > 999) {
            throw new IllegalArgumentException("Série da " + modelo + " inválida: o máximo é 999 (XSD TSerie).");
        }
        return String.format("%03d", numero);
    }

    /**
     * Null preserva o valor atual; 0 limpa e volta ao padrão 1. Limites do tipo {@code TNF} do XSD
     * oficial: {@code [1-9][0-9]{0,8}}, ou seja 1 a 999999999.
     */
    private void aplicarNumeroInicial(Consumer<Integer> setter, Integer novo, String modelo) {
        if (novo == null) {
            return;
        }
        if (novo < 0 || novo > 999_999_999) {
            throw new IllegalArgumentException(
                    "Número inicial da " + modelo + " inválido: use 1 a 999999999 (XSD TNF).");
        }
        setter.accept(novo > 0 ? novo : null);
    }

    public TestarConexaoResponse testarConexao(String targetUrl, String targetApiKey) {
        String baseUrl = StringUtils.hasText(targetUrl) ? targetUrl.trim() : defaultFlowboxUrl;
        if (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        }

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(3000);
        RestTemplate client = new RestTemplate(factory);

        long start = System.currentTimeMillis();

        // 1. Tentar /api/v1/sefaz/status ou /actuator/health
        String[] testPaths = new String[]{"/api/v1/sefaz/status", "/actuator/health", "/"};

        for (String path : testPaths) {
            String fullUrl = baseUrl + path;
            try {
                HttpHeaders headers = new HttpHeaders();
                if (StringUtils.hasText(targetApiKey)) {
                    headers.set("X-Flowbox-Api-Key", targetApiKey.trim());
                    headers.set("X-API-KEY", targetApiKey.trim());
                }

                HttpEntity<?> entity = new HttpEntity<>(headers);
                ResponseEntity<String> response = client.exchange(fullUrl, HttpMethod.GET, entity, String.class);
                long elapsed = System.currentTimeMillis() - start;

                if (response.getStatusCode().is2xxSuccessful()) {
                    return TestarConexaoResponse.builder()
                            .sucesso(true)
                            .statusHttp(response.getStatusCode().value())
                            .latenciaMs(elapsed)
                            .mensagem("Conexão estabelecida com sucesso com o Flowbox!")
                            .urlTestada(fullUrl)
                            .build();
                }
            } catch (Exception ex) {
                log.debug("Tentativa em {} falhou: {}", fullUrl, ex.getMessage());
            }
        }

        long elapsed = System.currentTimeMillis() - start;
        return TestarConexaoResponse.builder()
                .sucesso(false)
                .statusHttp(503)
                .latenciaMs(elapsed)
                .mensagem("Não foi possível alcançar o Flowbox no endereço especificado. Verifique se o serviço está em execução.")
                .urlTestada(baseUrl)
                .build();
    }
}
