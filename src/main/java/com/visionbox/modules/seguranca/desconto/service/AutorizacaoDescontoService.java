package com.visionbox.modules.seguranca.desconto.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.visionbox.modules.seguranca.desconto.domain.AlcadaDesconto;
import com.visionbox.modules.seguranca.desconto.dto.AutorizacaoDescontoRequest;
import com.visionbox.modules.seguranca.desconto.dto.AutorizacaoDescontoResponse;
import com.visionbox.modules.usuario.domain.Usuario;
import com.visionbox.modules.usuario.repository.UsuarioRepository;
import com.visionbox.shared.audit.LogAuditoria;
import com.visionbox.shared.audit.LogAuditoriaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Validação de alçada de desconto do PDV — P7.
 * <p>
 * Regras (ver {@link AlcadaDesconto}):
 * <ul>
 *   <li>≤ 15% → autoriza sem PIN (sem consultas, sem auditoria);</li>
 *   <li>&gt; 15% → PIN obrigatório. O PIN é a senha de login (BCrypt via
 *       {@link PasswordEncoder}) de um usuário ATIVO com perfil GERENTE/ADMIN da
 *       MESMA loja (D-010 — opção a). Identificação do autorizador é automática;</li>
 *   <li>falhas são contadas no {@link RateLimiterAlcada} (5 tentativas / 15 min
 *       por loja+usuário); >N tentativas → {@code rateLimitExcedido=true}, que o
 *       controller converte em 429;</li>
 *   <li>cada tentativa com PIN gera {@code LogAuditoria} append-only
 *       (acao=AUTORIZACAO_DESCONTO, detalheJson com % e resultado) — SEMPRE sem o PIN.</li>
 * </ul>
 * Timing: quando nenhum gerente casa o hash, um BCrypt "dummy" é executado para
 * não vazar por tempo o número de gerentes/inexistência de match.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AutorizacaoDescontoService {

    public static final String ACAO_AUDITORIA = "AUTORIZACAO_DESCONTO";
    public static final String ENTIDADE_AUDITORIA = "autorizacao_desconto";

    public static final String MENSAGEM_NEGADO = "Autorização negada. Verifique a senha de liberação.";

    private static final int MIN_PIN_LENGTH = 4;

    /**
     * Hash BCrypt público de teste (vetor conhecido de "password"). Usado APENAS
     * para equalizar o tempo de resposta quando nenhum gerente casa — o resultado
     * deste match é sempre descartado.
     */
    private static final String DUMMY_BCRYPT_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

    private final UsuarioRepository usuarioRepository;
    private final LogAuditoriaRepository logAuditoriaRepository;
    private final PasswordEncoder passwordEncoder;
    private final RateLimiterAlcada rateLimiter;
    private final ObjectMapper objectMapper;

    /**
     * @param lojaId        loja autenticada (TenantContext — nunca vinda do body)
     * @param solicitanteId usuário autenticado que pediu a alçada (subject do JWT)
     */
    @Transactional
    public AutorizacaoDescontoResponse autorizar(AutorizacaoDescontoRequest req,
                                                 UUID lojaId,
                                                 UUID solicitanteId,
                                                 String ipOrigem,
                                                 String userAgent) {
        BigDecimal percentual = req.getDescontoPercentual();
        if (percentual == null) {
            throw new IllegalArgumentException("descontoPercentual é obrigatório");
        }

        if (!AlcadaDesconto.exigePin(percentual)) {
            log.info("Alçada desconto desnecessária: loja={} solicitante={} pct={}", lojaId, solicitanteId, percentual);
            return AutorizacaoDescontoResponse.semAlcada(percentual);
        }

        String senha = req.getSenha() != null ? req.getSenha().trim() : "";
        String chaveRateLimit = chaveRateLimit(lojaId, solicitanteId);

        if (rateLimiter.excedeuLimite(chaveRateLimit)) {
            registrarAuditoria(lojaId, solicitanteId, percentual, "RATE_LIMIT", null, ipOrigem, userAgent);
            log.warn("Alçada desconto bloqueada por rate-limit: loja={} solicitante={} pct={}", lojaId, solicitanteId, percentual);
            return AutorizacaoDescontoResponse.bloqueadoPorRateLimit(percentual);
        }

        if (senha.length() < MIN_PIN_LENGTH) {
            rateLimiter.registrarFalha(chaveRateLimit);
            registrarAuditoria(lojaId, solicitanteId, percentual, "PIN_AUSENTE", null, ipOrigem, userAgent);
            return AutorizacaoDescontoResponse.negado(percentual, MENSAGEM_NEGADO);
        }

        Usuario autorizador = buscarAutorizador(lojaId, senha);
        if (autorizador == null) {
            rateLimiter.registrarFalha(chaveRateLimit);
            registrarAuditoria(lojaId, solicitanteId, percentual, "PIN_INVALIDO", null, ipOrigem, userAgent);
            log.warn("Alçada desconto negada: loja={} solicitante={} pct={}", lojaId, solicitanteId, percentual);
            return AutorizacaoDescontoResponse.negado(percentual, MENSAGEM_NEGADO);
        }

        rateLimiter.registrarSucesso(chaveRateLimit);
        registrarAuditoria(lojaId, solicitanteId, percentual, "PIN_OK", autorizador, ipOrigem, userAgent);
        log.info("Alçada desconto autorizada: loja={} solicitante={} pct={} autorizadoPor={}",
                lojaId, solicitanteId, percentual, autorizador.getId());
        return AutorizacaoDescontoResponse.autorizado(percentual, autorizador);
    }

    /**
     * Procura o gerente que casou o hash. Nunca loga nem devolve a senha.
     * Se ninguém casar, roda um BCrypt dummy para equalizar o tempo de resposta.
     */
    private Usuario buscarAutorizador(UUID lojaId, String senha) {
        List<Usuario> gerenciais = usuarioRepository
                .findByLojaIdAndPerfilInAndAtivoTrue(lojaId, AlcadaDesconto.PERFIS_GERENCIAIS);

        for (Usuario gerente : gerenciais) {
            if (passwordEncoder.matches(senha, gerente.getSenhaHash())) {
                return gerente;
            }
        }

        // Timing dummy: resultado descartado de propósito (nenhum match real acima).
        passwordEncoder.matches(senha, DUMMY_BCRYPT_HASH);
        return null;
    }

    private String chaveRateLimit(UUID lojaId, UUID solicitanteId) {
        return lojaId + ":" + (solicitanteId != null ? solicitanteId : "anonimo");
    }

    private void registrarAuditoria(UUID lojaId,
                                    UUID solicitanteId,
                                    BigDecimal percentual,
                                    String motivo,
                                    Usuario autorizador,
                                    String ipOrigem,
                                    String userAgent) {
        try {
            // LinkedHashMap de propósito: Map.of rejeita null (autorizador é null em negações)
            Map<String, Object> detalhes = new LinkedHashMap<>();
            detalhes.put("descontoPercentual", percentual.stripTrailingZeros().toPlainString());
            detalhes.put("motivo", motivo);
            detalhes.put("autorizadoPorId", autorizador != null ? autorizador.getId().toString() : null);
            detalhes.put("autorizadoPorNome", autorizador != null ? autorizador.getNome() : null);
            detalhes.put("autorizadoPorPerfil", autorizador != null ? autorizador.getPerfil().name() : null);
            String detalhe = objectMapper.writeValueAsString(detalhes);
            LogAuditoria audit = LogAuditoria.builder()
                    .lojaId(lojaId)
                    .entidade(ENTIDADE_AUDITORIA)
                    .acao(ACAO_AUDITORIA)
                    .usuarioId(solicitanteId != null ? solicitanteId.toString() : null)
                    .usuarioNome(autorizador != null ? autorizador.getNome() : null)
                    .ipOrigem(ipOrigem)
                    .userAgent(userAgent)
                    .detalheJson(detalhe)
                    .build();
            logAuditoriaRepository.save(audit);
        } catch (JsonProcessingException e) {
            // detalheJson é melhor esforço; nunca derruba a resposta da alçada por isso
            log.error("Falha ao serializar detalhe de auditoria de alçada (sem dado sensível): {}", e.getMessage());
        } catch (Exception e) {
            log.error("Falha ao registrar auditoria de alçada de desconto: {}", e.getMessage());
        }
    }
}