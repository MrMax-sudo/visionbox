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

import java.util.UUID;

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

        lojaRepository.save(loja);
        log.info("Configuração fiscal atualizada para a loja {}: flowboxUrl={} certificadoId={}",
                lojaId, loja.getFlowboxUrl(), loja.getFlowboxCertificadoId());

        return buscarConfig(lojaId);
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
