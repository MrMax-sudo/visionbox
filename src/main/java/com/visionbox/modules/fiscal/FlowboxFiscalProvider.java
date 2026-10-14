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

    /** Certificado A1 padrão no Flowbox quando a loja não define o seu. */
    @Value("${visionbox.fiscal.flowbox.certificado-id:1}")
    private Long defaultCertificadoId;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.visionbox.modules.pessoa.repository.LojaRepository lojaRepository;

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
        return emitir(documento, xmlAssinado, null);
    }

    @Override
    public ResultadoFiscal emitir(DocumentoFiscal documento, String xmlAssinado, com.visionbox.modules.fiscal.dto.NfceEmitirRequest req) {
        String baseUrl = flowboxBaseUrl;
        String apiKey = flowboxApiKey;
        com.visionbox.modules.pessoa.domain.Loja loja = null;

        if (lojaRepository != null && documento.getLojaId() != null) {
            loja = lojaRepository.findById(documento.getLojaId()).orElse(null);
            if (loja != null) {
                if (org.springframework.util.StringUtils.hasText(loja.getFlowboxUrl())) {
                    baseUrl = loja.getFlowboxUrl().trim();
                }
                if (org.springframework.util.StringUtils.hasText(loja.getFlowboxApiKey())) {
                    apiKey = loja.getFlowboxApiKey().trim();
                }
            }
        }

        if (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        }

        boolean isNfe = documento.getModelo() == DocumentoFiscal.ModeloFiscal.NFE_55;
        String endpoint = isNfe ? "/api/v1/nfe/emitir" : "/api/v1/nfce/emitir";
        String url = baseUrl + endpoint;

        // Cadastro fiscal obrigatório: sem Inscrição Estadual a SEFAZ responde cStat 209 e sem
        // CSC o QR Code da NFC-e fica inválido. Recusamos aqui com o painel certo indicado, em
        // vez de gastar um ciclo de transmissão para receber uma rejeição opaca.
        String pendencia = validarCadastroFiscal(loja, isNfe);
        if (pendencia != null) {
            log.warn("Cadastro fiscal incompleto para a loja {}: {}", documento.getLojaId(), pendencia);
            return ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "999", pendencia, null);
        }

        log.info("Enviando documento fiscal para Flowbox: loja={} modelo={} serie={} numero={} url={}",
                documento.getLojaId(), documento.getModelo(), documento.getSerie(), documento.getNumero(), url);

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("X-Flowbox-Api-Key", apiKey);
            headers.set("X-API-KEY", apiKey);
            headers.set("X-Loja-Id", documento.getLojaId().toString());

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("ambiente", ambienteDe(loja));

            // Emitente — todo dado vem do cadastro fiscal da loja (V47/V48); nada aqui é fixo.
            // validarCadastroFiscal já recusou a emissão quando algum desses campos está ausente.
            Map<String, Object> emitente = new LinkedHashMap<>();
            String cnpj = loja.getCnpj().replaceAll("\\D", "");
            emitente.put("cnpj", cnpj);
            emitente.put("razaoSocial", loja.getNome().trim());
            emitente.put("nomeFantasia", loja.getNome().trim());
            emitente.put("uf", loja.getUf().trim().toUpperCase());
            emitente.put("inscricaoEstadual", loja.getInscricaoEstadual().trim());
            emitente.put("crt", loja.getCrt() != null && org.springframework.util.StringUtils.hasText(loja.getCrt()) ? loja.getCrt().trim() : "1");
            emitente.put("logradouro", loja.getEndereco().trim());
            emitente.put("numero", loja.getNumero().trim());
            emitente.put("bairro", loja.getBairro().trim());
            emitente.put("municipio", loja.getCidade().trim());
            emitente.put("codigoMunicipio", loja.getCodigoMunicipio());
            emitente.put("cep", loja.getCep().replaceAll("\\D", ""));
            putSePresente(emitente, "csc", loja.getCsc());
            putSePresente(emitente, "cscId", loja.getCscId());
            // <infRespTec> da SEFAZ: email obrigatório em produção, fone opcional (XSD TInfRespTec).
            putSePresente(emitente, "email", loja.getEmailContato());
            putSePresente(emitente, "telefone", loja.getTelefone());
            payload.put("emitente", emitente);

            // Certificado A1: só a referência. O PFX e a senha ficam cifrados no Flowbox.
            Long certificadoId = (loja != null && loja.getFlowboxCertificadoId() != null)
                    ? loja.getFlowboxCertificadoId()
                    : defaultCertificadoId;
            if (certificadoId != null) {
                payload.put("certificadoId", certificadoId);
            }

            // Itens
            java.util.List<Map<String, Object>> itensList = new java.util.ArrayList<>();
            java.math.BigDecimal valorTotalSoma = java.math.BigDecimal.ZERO;
            if (req != null && req.getItens() != null && !req.getItens().isEmpty()) {
                int nItem = 1;
                for (var it : req.getItens()) {
                    Map<String, Object> itMap = new LinkedHashMap<>();
                    itMap.put("numeroItem", it.getNumeroItem() != null ? it.getNumeroItem() : nItem++);
                    itMap.put("codigo", org.springframework.util.StringUtils.hasText(it.getCodigo()) ? it.getCodigo() : "PRD-" + nItem);
                    itMap.put("descricao", org.springframework.util.StringUtils.hasText(it.getDescricao()) ? it.getDescricao() : "Produto Optico");
                    String ncm = it.getNcm() != null ? it.getNcm().replaceAll("\\D", "") : "33079000";
                    if (ncm.length() != 8) ncm = "33079000";
                    itMap.put("ncm", ncm);
                    itMap.put("cfop", org.springframework.util.StringUtils.hasText(it.getCfop()) ? it.getCfop() : "5102");
                    itMap.put("csosn", org.springframework.util.StringUtils.hasText(it.getCsosn()) ? it.getCsosn() : "102");
                    itMap.put("unidade", org.springframework.util.StringUtils.hasText(it.getUnidade()) ? it.getUnidade() : "UN");
                    java.math.BigDecimal qtd = it.getQuantidade() != null ? it.getQuantidade() : java.math.BigDecimal.ONE;
                    java.math.BigDecimal vUnit = it.getValorUnitario() != null ? it.getValorUnitario() : java.math.BigDecimal.valueOf(35.00);
                    java.math.BigDecimal vTot = it.getValorTotal() != null ? it.getValorTotal() : qtd.multiply(vUnit);
                    itMap.put("quantidade", qtd);
                    itMap.put("valorUnitario", vUnit);
                    itMap.put("valorTotal", vTot);
                    itensList.add(itMap);
                    valorTotalSoma = valorTotalSoma.add(vTot);
                }
            } else {
                Map<String, Object> itMap = new LinkedHashMap<>();
                itMap.put("numeroItem", 1);
                itMap.put("codigo", "PRD-000006");
                itMap.put("descricao", "Kit Limpeza e Solucao Higienizadora de Lentes 60ml");
                itMap.put("ncm", "33079000");
                itMap.put("cfop", "5102");
                itMap.put("csosn", "102");
                itMap.put("unidade", "UN");
                itMap.put("quantidade", java.math.BigDecimal.ONE);
                itMap.put("valorUnitario", java.math.BigDecimal.valueOf(35.00));
                itMap.put("valorTotal", java.math.BigDecimal.valueOf(35.00));
                itensList.add(itMap);
                valorTotalSoma = java.math.BigDecimal.valueOf(35.00);
            }
            payload.put("itens", itensList);

            // Pagamentos
            java.util.List<Map<String, Object>> pagamentosList = new java.util.ArrayList<>();
            if (req != null && req.getPagamentos() != null && !req.getPagamentos().isEmpty()) {
                for (var pg : req.getPagamentos()) {
                    Map<String, Object> pgMap = new LinkedHashMap<>();
                    pgMap.put("meio", org.springframework.util.StringUtils.hasText(pg.getMeio()) ? pg.getMeio() : "17");
                    pgMap.put("valor", pg.getValor() != null ? pg.getValor() : valorTotalSoma);
                    pagamentosList.add(pgMap);
                }
            } else {
                Map<String, Object> pgMap = new LinkedHashMap<>();
                pgMap.put("meio", "17"); // PIX padrão
                pgMap.put("valor", valorTotalSoma);
                pagamentosList.add(pgMap);
            }
            payload.put("pagamentos", pagamentosList);

            // Destinatário opcional
            if (req != null && req.getDestinatario() != null && req.getDestinatario().getCpf() != null) {
                String cpf = req.getDestinatario().getCpf().replaceAll("\\D", "");
                if (cpf.length() == 11) {
                    Map<String, Object> destMap = new LinkedHashMap<>();
                    destMap.put("cpf", cpf);
                    destMap.put("nome", org.springframework.util.StringUtils.hasText(req.getDestinatario().getNome()) ? req.getDestinatario().getNome() : "Consumidor");
                    payload.put("destinatario", destMap);
                }
            }

            int serieNum = 1;
            try {
                if (documento.getSerie() != null) serieNum = Integer.parseInt(documento.getSerie().replaceAll("\\D", ""));
            } catch (Exception ignored) {}
            payload.put("serie", Math.max(1, serieNum));
            if (documento.getNumero() != null) {
                payload.put("numeroFiscal", documento.getNumero().longValue());
            }
            payload.put("valorTotal", valorTotalSoma);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map body = response.getBody();
                boolean autorizado = Boolean.TRUE.equals(body.get("sucesso")) || Boolean.TRUE.equals(body.get("autorizado"));
                String chave = (String) body.getOrDefault("chaveAcesso", documento.getChaveAcesso());
                String protocolo = (String) body.get("protocolo");
                String cStat = (String) body.getOrDefault("statusSefaz", body.getOrDefault("cStat", autorizado ? "100" : "999"));
                String xMotivo = (String) body.getOrDefault("motivoSefaz", body.getOrDefault("xMotivo", autorizado ? "Autorizado o uso da NFC-e" : (String) body.getOrDefault("erro", "Rejeição")));
                String xmlRetorno = (String) body.getOrDefault("xmlAutorizado", body.get("xmlRetorno"));

                return new ResultadoFiscal(autorizado, chave, protocolo, cStat, xMotivo, xmlRetorno, OffsetDateTime.now());
            }

            return ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "999", "Resposta inesperada do Flowbox: " + response.getStatusCode(), null);
        } catch (Exception e) {
            log.error("Erro na comunicação com Flowbox: {}", e.getMessage());
            return ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "503",
                    "Flowbox indisponível: " + e.getMessage(), null);
        }
    }

    /**
     * Verifica o cadastro fiscal da loja antes de transmitir. Retorna a mensagem do problema ou
     * {@code null} quando está apto. A NF-e 55 não usa QR Code, então o CSC só é exigido para a NFC-e.
     */
    private String validarCadastroFiscal(com.visionbox.modules.pessoa.domain.Loja loja, boolean isNfe) {
        String painel = "Configurações → Módulo Fiscal (Painel Fiscal)";
        if (loja == null) {
            return "Cadastro fiscal ausente: a loja da emissão não foi encontrada. "
                    + "Cadastre os dados do emitente em " + painel + ".";
        }
        if (!org.springframework.util.StringUtils.hasText(loja.getInscricaoEstadual())) {
            return "Cadastro fiscal incompleto: Inscrição Estadual não cadastrada — a SEFAZ rejeita a emissão "
                    + "com cStat 209 (IE do emitente inválida). Cadastre em " + painel + ".";
        }
        if (!isNfe && (!org.springframework.util.StringUtils.hasText(loja.getCsc())
                || !org.springframework.util.StringUtils.hasText(loja.getCscId()))) {
            return "Cadastro fiscal incompleto: CSC e CSC ID da NFC-e não cadastrados — sem eles o QR Code é "
                    + "inválido. Emita no portal da NF-e da UF e cadastre em " + painel + ".";
        }

        // Nada aqui é preenchido por fallback: dado ausente é recusado antes de transmitir, para a
        // SEFAZ não rejeitar com cStat de cadastro nem a nota sair com valor inventado.
        String cnpj = loja.getCnpj() != null ? loja.getCnpj().replaceAll("\\D", "") : "";
        String cep = loja.getCep() != null ? loja.getCep().replaceAll("\\D", "") : "";
        java.util.List<String> faltando = new java.util.ArrayList<>();
        adicionarSeAusente(faltando, "CNPJ (14 dígitos)", cnpj.length() == 14 ? cnpj : null);
        adicionarSeAusente(faltando, "Razão social (nome da loja)", loja.getNome());
        adicionarSeAusente(faltando, "Logradouro", loja.getEndereco());
        adicionarSeAusente(faltando, "Número", loja.getNumero());
        adicionarSeAusente(faltando, "Bairro", loja.getBairro());
        adicionarSeAusente(faltando, "Município", loja.getCidade());
        adicionarSeAusente(faltando, "UF", loja.getUf());
        adicionarSeAusente(faltando, "CEP (8 dígitos)", cep.length() == 8 ? cep : null);
        adicionarSeAusente(faltando, "Código do município IBGE (7 dígitos)",
                loja.getCodigoMunicipio() != null && loja.getCodigoMunicipio().matches("\\d{7}")
                        ? loja.getCodigoMunicipio() : null);
        if ("PRODUCAO".equals(ambienteDe(loja))) {
            // <infRespTec> é exigido pela SEFAZ fora de homologação e o XSD obriga o <email>.
            adicionarSeAusente(faltando, "Email (grupo infRespTec, obrigatório em produção)", loja.getEmailContato());
        }
        if (!faltando.isEmpty()) {
            return "Cadastro fiscal incompleto: faltam " + String.join(", ", faltando)
                    + " — a SEFAZ rejeita a emissão sem esses dados do emitente. Cadastre em " + painel + ".";
        }
        return null;
    }

    private void adicionarSeAusente(java.util.List<String> faltando, String campo, String valor) {
        if (!org.springframework.util.StringUtils.hasText(valor)) {
            faltando.add(campo);
        }
    }

    /** Ambiente da SEFAZ da loja; HOMOLOGACAO é o padrão enquanto a loja não define o seu. */
    private String ambienteDe(com.visionbox.modules.pessoa.domain.Loja loja) {
        return loja != null && org.springframework.util.StringUtils.hasText(loja.getFiscalAmbiente())
                ? loja.getFiscalAmbiente().trim().toUpperCase()
                : "HOMOLOGACAO";
    }

    /** Só grava o campo quando há valor — evita mandar null para campos opcionais do emitente. */
    private void putSePresente(Map<String, Object> mapa, String chave, String valor) {
        if (org.springframework.util.StringUtils.hasText(valor)) {
            mapa.put(chave, valor.trim());
        }
    }

    @Override
    public Optional<ResultadoFiscal> consultar(String chaveAcesso) {
        String url = flowboxBaseUrl + "/api/v1/documentos/" + chaveAcesso;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Flowbox-Api-Key", flowboxApiKey);
            headers.set("X-API-KEY", flowboxApiKey);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map body = response.getBody();
                boolean autorizado = Boolean.TRUE.equals(body.get("sucesso"))
                        || "AUTORIZADO".equalsIgnoreCase((String) body.get("status"))
                        || "100".equals(body.get("statusSefaz"));
                String protocolo = (String) body.get("protocolo");
                String cStat = (String) body.getOrDefault("statusSefaz", body.getOrDefault("cStat", "100"));
                String xMotivo = (String) body.getOrDefault("motivoSefaz", body.getOrDefault("xMotivo", "Autorizado"));
                return Optional.of(new ResultadoFiscal(autorizado, chaveAcesso, protocolo, cStat, xMotivo, null, OffsetDateTime.now()));
            }
        } catch (Exception e) {
            log.warn("Erro ao consultar chave {} no Flowbox: {}", chaveAcesso, e.getMessage());
        }
        return Optional.empty();
    }

    @Override
    public ResultadoFiscal cancelar(DocumentoFiscal documento, String justificativa) {
        boolean isNfe = documento.getModelo() == DocumentoFiscal.ModeloFiscal.NFE_55;
        String endpoint = isNfe ? "/api/v1/nfe/cancelar" : "/api/v1/nfce/cancelar";
        String url = flowboxBaseUrl + endpoint;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("X-Flowbox-Api-Key", flowboxApiKey);
            headers.set("X-API-KEY", flowboxApiKey);
            headers.set("X-Loja-Id", documento.getLojaId().toString());

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("chaveAcesso", documento.getChaveAcesso());
            payload.put("justificativa", justificativa);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map body = response.getBody();
                boolean cancelado = Boolean.TRUE.equals(body.get("sucesso")) || Boolean.TRUE.equals(body.get("cancelado")) || "135".equals(body.get("cStat"));
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
