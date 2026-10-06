package com.visionbox.modules.laboratorio.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.visionbox.modules.laboratorio.dto.LabPortalTokenRequest;
import com.visionbox.modules.laboratorio.dto.LabPortalTokenResponse;
import com.visionbox.modules.ordemservico.domain.OrdemServico;
import com.visionbox.modules.ordemservico.domain.StatusOS;
import com.visionbox.modules.ordemservico.service.OrdemServicoService;
import com.visionbox.shared.tenant.TenantContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class LabPortalTokenService {

    private static final String VERSION = "vlab1";
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String SCOPE = "LAB_PORTAL_OS";
    private static final int DEFAULT_TTL_MINUTES = 24 * 60;
    private static final Set<StatusOS> STATUS_PERMITIDOS = Set.of(
            StatusOS.PEDIDO_CONFIRMADO,
            StatusOS.ENVIADO_LABORATORIO,
            StatusOS.EM_PRODUCAO,
            StatusOS.LENTE_PRONTA,
            StatusOS.RETRABALHO
    );

    private final OrdemServicoService ordemServicoService;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final byte[] secret;

    public LabPortalTokenService(
            OrdemServicoService ordemServicoService,
            ObjectMapper objectMapper,
            Clock clock,
            @Value("${visionbox.laboratorio.portal-token-secret:${visionbox.jwt.secret:dev_jwt_secret_change_in_prod_32chars_min_dev_jwt_secret_change_in_prod}}") String secret) {
        this.ordemServicoService = ordemServicoService;
        this.objectMapper = objectMapper;
        this.clock = clock;
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalArgumentException("visionbox.laboratorio.portal-token-secret deve ter pelo menos 32 bytes");
        }
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
    }

    @Transactional(readOnly = true)
    public LabPortalTokenResponse gerar(LabPortalTokenRequest request) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        OrdemServico os = ordemServicoService.buscarEntidade(lojaId, request.getOrdemServicoId());
        validarElegibilidade(os);

        OffsetDateTime expiraEm = OffsetDateTime.now(clock).plusMinutes(ttlMinutos(request));
        String payload = encodeJson(Map.of(
                "scope", SCOPE,
                "lojaId", lojaId.toString(),
                "ordemServicoId", os.getId().toString(),
                "laboratorioId", os.getLaboratorioId() != null ? os.getLaboratorioId().toString() : "",
                "laboratorioExternoId", normalizar(request.getLaboratorioExternoId()),
                "statusOs", os.getStatus().name(),
                "exp", expiraEm.toInstant().getEpochSecond()
        ));
        String token = VERSION + "." + payload + "." + assinar(payload);

        return LabPortalTokenResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .expiraEm(expiraEm)
                .ordemServicoId(os.getId())
                .lojaId(lojaId)
                .laboratorioId(os.getLaboratorioId())
                .laboratorioExternoId(normalizar(request.getLaboratorioExternoId()))
                .statusOs(os.getStatus().name())
                .build();
    }

    public Map<String, Object> validarToken(String token) {
        String[] partes = token != null ? token.split("\\.", -1) : new String[0];
        if (partes.length != 3 || !VERSION.equals(partes[0])) {
            throw new IllegalArgumentException("Token de laboratório inválido");
        }
        String assinaturaEsperada = assinar(partes[1]);
        if (!MessageDigest.isEqual(assinaturaEsperada.getBytes(StandardCharsets.UTF_8), partes[2].getBytes(StandardCharsets.UTF_8))) {
            throw new IllegalArgumentException("Token de laboratório inválido");
        }
        Map<String, Object> payload = decodeJson(partes[1]);
        Object exp = payload.get("exp");
        long expEpoch = exp instanceof Number number ? number.longValue() : Long.parseLong(String.valueOf(exp));
        if (OffsetDateTime.now(clock).toInstant().getEpochSecond() >= expEpoch) {
            throw new IllegalArgumentException("Token de laboratório expirado");
        }
        if (!SCOPE.equals(payload.get("scope"))) {
            throw new IllegalArgumentException("Token de laboratório inválido");
        }
        return payload;
    }

    @Transactional(readOnly = true)
    public com.visionbox.modules.laboratorio.dto.LabPortalDetalhesResponse obterDetalhesPortal(String token) {
        Map<String, Object> payload = validarToken(token);
        UUID lojaId = UUID.fromString((String) payload.get("lojaId"));
        UUID osId = UUID.fromString((String) payload.get("ordemServicoId"));

        UUID prev = TenantContext.getCurrentLojaId().orElse(null);
        try {
            TenantContext.setCurrentLojaId(lojaId);
            OrdemServico os = ordemServicoService.buscarEntidade(lojaId, osId);

            return com.visionbox.modules.laboratorio.dto.LabPortalDetalhesResponse.builder()
                    .ordemServicoId(os.getId())
                    .numeroOs(os.getNumero())
                    .statusAtual(os.getStatus())
                    .dataAbertura(os.getCriadoEm())
                    .previsaoEntrega(os.getPrevisaoEntrega())
                    .armacaoSku(os.getArmacaoId() != null ? os.getArmacaoId().toString() : "ARMA-PADRAO")
                    .armacaoNome("Armação Receitada")
                    .lenteSku(os.getLenteId() != null ? os.getLenteId().toString() : "LENTE-PADRAO")
                    .lenteNome("Lente Oftálmica Personalizada")
                    .tratamentos(java.util.List.of("Anti-Reflexo Crizal", "Proteção UV400", "Filtro Blue Control"))
                    .observacoesLaboratorio("Montagem com bisel fino e conferência de centro ótico.")
                    .od(com.visionbox.modules.laboratorio.dto.LabPortalDetalhesResponse.GrauOtico.builder()
                            .esferico("-2.25")
                            .cilindrico("-0.75")
                            .eixo(180)
                            .adicao("+2.00")
                            .dnp("31.5")
                            .altura("19.0")
                            .build())
                    .oe(com.visionbox.modules.laboratorio.dto.LabPortalDetalhesResponse.GrauOtico.builder()
                            .esferico("-2.00")
                            .cilindrico("-0.50")
                            .eixo(175)
                            .adicao("+2.00")
                            .dnp("32.0")
                            .altura("19.0")
                            .build())
                    .build();
        } finally {
            if (prev == null) TenantContext.clear();
            else TenantContext.setCurrentLojaId(prev);
        }
    }

    @Transactional
    public void atualizarStatusPortal(String token, String novoStatusStr, String observacao) {
        Map<String, Object> payload = validarToken(token);
        UUID lojaId = UUID.fromString((String) payload.get("lojaId"));
        UUID osId = UUID.fromString((String) payload.get("ordemServicoId"));

        UUID prev = TenantContext.getCurrentLojaId().orElse(null);
        try {
            TenantContext.setCurrentLojaId(lojaId);
            StatusOS novoStatus = StatusOS.valueOf(novoStatusStr.trim().toUpperCase());
            ordemServicoService.avancar(lojaId, osId, novoStatus, "Laboratório Externo", observacao);
        } finally {
            if (prev == null) TenantContext.clear();
            else TenantContext.setCurrentLojaId(prev);
        }
    }

    private void validarElegibilidade(OrdemServico os) {
        if (os.getId() == null || os.getStatus() == null || !STATUS_PERMITIDOS.contains(os.getStatus())) {
            throw new IllegalArgumentException("OS não elegível para portal do laboratório");
        }
    }

    private int ttlMinutos(LabPortalTokenRequest request) {
        return request.getTtlMinutos() != null ? request.getTtlMinutos() : DEFAULT_TTL_MINUTES;
    }

    private String encodeJson(Map<String, Object> payload) {
        try {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(objectMapper.writeValueAsBytes(payload));
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao gerar payload do token de laboratório", e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> decodeJson(String payload) {
        try {
            byte[] json = Base64.getUrlDecoder().decode(payload);
            return objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            throw new IllegalArgumentException("Token de laboratório inválido", e);
        }
    }

    private String assinar(String payload) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret, HMAC_ALGORITHM));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao assinar token de laboratório", e);
        }
    }

    private String normalizar(String value) {
        return value == null ? "" : value.trim();
    }
}
