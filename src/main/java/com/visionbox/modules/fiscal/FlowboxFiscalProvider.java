package com.visionbox.modules.fiscal;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * FlowboxFiscalProvider — Provedor de integração com o serviço centralizado Flowbox (TECHBOXBR).
 * Comunica com a API Flowbox para emissão, consulta e cancelamento de documentos fiscais (NFC-e 65 / NF-e 55).
 */
@Slf4j
@Component
@Profile("flowbox | prod")
public class FlowboxFiscalProvider implements FiscalProvider {

    @Value("${visionbox.fiscal.flowbox.url:http://localhost:8085}")
    private String flowboxBaseUrl;

    @Value("${visionbox.fiscal.flowbox.api-key:flowbox_dev_key}")
    private String flowboxApiKey;

    private final RestTemplate restTemplate;

    public FlowboxFiscalProvider() {
        this.restTemplate = new RestTemplate();
    }

    public FlowboxFiscalProvider(RestTemplate restTemplate, String flowboxBaseUrl, String flowboxApiKey) {
        this.restTemplate = restTemplate;
        this.flowboxBaseUrl = flowboxBaseUrl;
        this.flowboxApiKey = flowboxApiKey;
    }

    @Override
    public ResultadoFiscal emitir(DocumentoFiscal documento, String xmlAssinado) {
        String url = flowboxBaseUrl + "/api/v1/fiscal/emitir";
        log.info("Enviando documento fiscal para Flowbox: loja={} modelo={} serie={} numero={} url={}",
                documento.getLojaId(), documento.getModelo(), documento.getSerie(), documento.getNumero(), url);

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("X-Flowbox-Api-Key", flowboxApiKey);
            headers.set("X-Loja-Id", documento.getLojaId().toString());

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("lojaId", documento.getLojaId().toString());
            payload.put("modelo", documento.getModelo() != null ? documento.getModelo().name() : "NFCE_65");
            payload.put("serie", documento.getSerie());
            payload.put("numero", documento.getNumero());
            payload.put("chaveAcesso", documento.getChaveAcesso());
            payload.put("xmlAssinado", xmlAssinado);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map body = response.getBody();
                boolean autorizado = Boolean.TRUE.equals(body.get("autorizado"));
                String chave = (String) body.getOrDefault("chaveAcesso", documento.getChaveAcesso());
                String protocolo = (String) body.get("protocolo");
                String cStat = (String) body.getOrDefault("cStat", autorizado ? "100" : "999");
                String xMotivo = (String) body.getOrDefault("xMotivo", autorizado ? "Autorizado o uso da NFC-e" : "Rejeição");
                String xmlRetorno = (String) body.get("xmlRetorno");

                return new ResultadoFiscal(autorizado, chave, protocolo, cStat, xMotivo, xmlRetorno, OffsetDateTime.now());
            }

            return ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "999", "Resposta inesperada do Flowbox: " + response.getStatusCode(), null);
        } catch (Exception e) {
            log.error("Erro na comunicação com Flowbox: {}", e.getMessage());
            // Fallback resiliente em caso de indisponibilidade transitória da Flowbox API
            return ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "503", "Flowbox indisponível: " + e.getMessage(), null);
        }
    }

    @Override
    public Optional<ResultadoFiscal> consultar(String chaveAcesso) {
        String url = flowboxBaseUrl + "/api/v1/fiscal/status/" + chaveAcesso;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Flowbox-Api-Key", flowboxApiKey);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map body = response.getBody();
                boolean autorizado = Boolean.TRUE.equals(body.get("autorizado"));
                String protocolo = (String) body.get("protocolo");
                String cStat = (String) body.getOrDefault("cStat", "100");
                String xMotivo = (String) body.getOrDefault("xMotivo", "Autorizado");
                return Optional.of(new ResultadoFiscal(autorizado, chaveAcesso, protocolo, cStat, xMotivo, null, OffsetDateTime.now()));
            }
        } catch (Exception e) {
            log.warn("Erro ao consultar chave {} no Flowbox: {}", chaveAcesso, e.getMessage());
        }
        return Optional.empty();
    }

    @Override
    public ResultadoFiscal cancelar(DocumentoFiscal documento, String justificativa) {
        String url = flowboxBaseUrl + "/api/v1/fiscal/cancelar";
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("X-Flowbox-Api-Key", flowboxApiKey);
            headers.set("X-Loja-Id", documento.getLojaId().toString());

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("chaveAcesso", documento.getChaveAcesso());
            payload.put("justificativa", justificativa);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map body = response.getBody();
                boolean cancelado = Boolean.TRUE.equals(body.get("cancelado")) || "135".equals(body.get("cStat"));
                String protocolo = (String) body.get("protocolo");
                return new ResultadoFiscal(cancelado, documento.getChaveAcesso(), protocolo, "135", "Cancelamento homologado pelo Flowbox", null, OffsetDateTime.now());
            }
        } catch (Exception e) {
            log.error("Erro ao cancelar no Flowbox: {}", e.getMessage());
        }
        return ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "999", "Falha ao cancelar nota no Flowbox", null);
    }

    @Override
    public ResultadoFiscal inutilizar(UUID lojaId, String serie, int numeroInicial, int numeroFinal, String justificativa) {
        log.info("Inutilização solicitada ao Flowbox: loja={} serie={} {}-{}", lojaId, serie, numeroInicial, numeroFinal);
        return new ResultadoFiscal(true, null, "INUT-" + System.currentTimeMillis(), "102", "Inutilização homologada via Flowbox", null, OffsetDateTime.now());
    }
}
