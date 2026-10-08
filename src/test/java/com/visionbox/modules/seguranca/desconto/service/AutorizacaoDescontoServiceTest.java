package com.visionbox.modules.seguranca.desconto.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.visionbox.modules.seguranca.desconto.dto.AutorizacaoDescontoRequest;
import com.visionbox.modules.seguranca.desconto.dto.AutorizacaoDescontoResponse;
import com.visionbox.modules.usuario.domain.Perfil;
import com.visionbox.modules.usuario.domain.Usuario;
import com.visionbox.modules.usuario.repository.UsuarioRepository;
import com.visionbox.shared.audit.LogAuditoria;
import com.visionbox.shared.audit.LogAuditoriaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AutorizacaoDescontoServiceTest {

    private static final UUID LOJA_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID SOLICITANTE_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    private UsuarioRepository usuarioRepository;
    private LogAuditoriaRepository logAuditoriaRepository;
    private PasswordEncoder passwordEncoder;
    private RateLimiterAlcada rateLimiter;
    private AutorizacaoDescontoService service;

    @BeforeEach
    void setUp() {
        usuarioRepository = mock(UsuarioRepository.class);
        logAuditoriaRepository = mock(LogAuditoriaRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        // janela fixa: 5 falhas em 15 minutos; clock congelado em um instante estável
        rateLimiter = new RateLimiterAlcada(5, 15, Clock.fixed(Instant.parse("2026-10-08T10:00:00Z"), ZoneOffset.UTC));
        service = new AutorizacaoDescontoService(
                usuarioRepository,
                logAuditoriaRepository,
                passwordEncoder,
                rateLimiter,
                new ObjectMapper());
    }

    private AutorizacaoDescontoRequest request(String percentual, String senha) {
        return AutorizacaoDescontoRequest.builder()
                .descontoPercentual(new BigDecimal(percentual))
                .senha(senha)
                .build();
    }

    private Usuario gerente() {
        Usuario gerente = Usuario.builder()
                .lojaId(LOJA_ID)
                .nome("Maria Gerente")
                .email("maria@visionbox.com.br")
                .senhaHash("hash-gerente")
                .perfil(Perfil.GERENTE)
                .build();
        gerente.setId(UUID.randomUUID());
        gerente.setAtivo(true);
        return gerente;
    }

    // ===== Cenários exigidos pelo P7 =====

    @Test
    @DisplayName("Desconto ≤ 15% autoriza sem PIN e sem consultas")
    void descontoAte15PorcentoAutorizaSemPin() {
        AutorizacaoDescontoResponse resp = service.autorizar(request("15", null), LOJA_ID, SOLICITANTE_ID, "10.0.0.1", "test");

        assertThat(resp.autorizado()).isTrue();
        assertThat(resp.exigePin()).isFalse();
        assertThat(resp.rateLimitExcedido()).isFalse();
        assertThat(resp.autorizadoPorId()).isNull();
        // nem usuários, nem encoder, nem auditoria — caminho sem PIN é barato e não registra tentativa
        verifyNoInteractions(usuarioRepository, passwordEncoder, logAuditoriaRepository);
    }

    @Test
    @DisplayName("Desconto acima de 15% com PIN de gerente válido autoriza e identifica quem autorizou")
    void descontoAcimaDe15ComPinValidoAutoriza() {
        Usuario gerente = gerente();
        when(usuarioRepository.findByLojaIdAndPerfilInAndAtivoTrue(eq(LOJA_ID), any()))
                .thenReturn(List.of(gerente));
        when(passwordEncoder.matches("senha-forte", gerente.getSenhaHash())).thenReturn(true);

        AutorizacaoDescontoResponse resp = service.autorizar(
                request("18.5", "senha-forte"), LOJA_ID, SOLICITANTE_ID, "10.0.0.1", "test");

        assertThat(resp.autorizado()).isTrue();
        assertThat(resp.exigePin()).isTrue();
        assertThat(resp.rateLimitExcedido()).isFalse();
        assertThat(resp.autorizadoPorId()).isEqualTo(gerente.getId());
        assertThat(resp.autorizadoPorNome()).isEqualTo("Maria Gerente");
        assertThat(resp.autorizadoPorPerfil()).isEqualTo("GERENTE");
        assertThat(resp.descontoPercentual()).isEqualByComparingTo("18.5");

        // auditoria: quem, quando (auto), % — e NUNCA o PIN
        ArgumentCaptor<LogAuditoria> captor = ArgumentCaptor.forClass(LogAuditoria.class);
        verify(logAuditoriaRepository, times(1)).save(captor.capture());
        LogAuditoria audit = captor.getValue();
        assertThat(audit.getAcao()).isEqualTo(AutorizacaoDescontoService.ACAO_AUDITORIA);
        assertThat(audit.getEntidade()).isEqualTo(AutorizacaoDescontoService.ENTIDADE_AUDITORIA);
        assertThat(audit.getLojaId()).isEqualTo(LOJA_ID);
        assertThat(audit.getUsuarioId()).isEqualTo(SOLICITANTE_ID.toString());
        assertThat(audit.getDetalheJson())
                .contains("\"descontoPercentual\":\"18.5\"")
                .contains("\"autorizadoPorNome\":\"Maria Gerente\"")
                .contains("\"motivo\":\"PIN_OK\"")
                .doesNotContain("senha-forte");
        verify(passwordEncoder, times(1)).matches(eq("senha-forte"), eq(gerente.getSenhaHash()));

        // sucesso zera o contador de falhas do rate-limit
        assertThat(rateLimiter.excedeuLimite(LOJA_ID + ":" + SOLICITANTE_ID)).isFalse();
    }

    @Test
    @DisplayName("Desconto acima de 15% com PIN inválido nega de forma genérica e registra falha")
    void pinInvalidoNega() {
        Usuario gerente = gerente();
        when(usuarioRepository.findByLojaIdAndPerfilInAndAtivoTrue(eq(LOJA_ID), any()))
                .thenReturn(List.of(gerente));
        when(passwordEncoder.matches(any(), any())).thenReturn(false);

        AutorizacaoDescontoResponse resp = service.autorizar(
                request("20", "senha-errada"), LOJA_ID, SOLICITANTE_ID, "10.0.0.1", "test");

        assertThat(resp.autorizado()).isFalse();
        assertThat(resp.exigePin()).isTrue();
        assertThat(resp.rateLimitExcedido()).isFalse();
        assertThat(resp.mensagem()).isEqualTo(AutorizacaoDescontoService.MENSAGEM_NEGADO);
        assertThat(resp.autorizadoPorNome()).isNull();

        // auditoria registra a NEGAÇÃO com motivo — sem revelar nada ao cliente
        ArgumentCaptor<LogAuditoria> captor = ArgumentCaptor.forClass(LogAuditoria.class);
        verify(logAuditoriaRepository).save(captor.capture());
        assertThat(captor.getValue().getDetalheJson()).contains("\"motivo\":\"PIN_INVALIDO\"");

        // a falha entrou no rate-limit da chave
        assertThat(rateLimiter.excedeuLimite(LOJA_ID + ":" + SOLICITANTE_ID)).isFalse(); // 1 < 5
        for (int i = 0; i < 4; i++) {
            service.autorizar(request("20", "senha-errada"), LOJA_ID, SOLICITANTE_ID, "10.0.0.1", "test");
        }
        assertThat(rateLimiter.excedeuLimite(LOJA_ID + ":" + SOLICITANTE_ID)).isTrue();
    }

    @Test
    @DisplayName("Rate-limit bloqueia após N tentativas mesmo com PIN correto")
    void rateLimitBloqueiaAposNTentativas() {
        Usuario gerente = gerente();
        when(usuarioRepository.findByLojaIdAndPerfilInAndAtivoTrue(eq(LOJA_ID), any()))
                .thenReturn(List.of(gerente));
        when(passwordEncoder.matches(any(), any())).thenReturn(false);

        // 5 falhas consecutivas estouram a janela de 15 min
        for (int i = 0; i < 5; i++) {
            service.autorizar(request("25", "errada" + i), LOJA_ID, SOLICITANTE_ID, "10.0.0.1", "test");
        }

        // 6ª tentativa: bloqueada ANTES mesmo de tocar o PIN — mesmo que agora fosse correto
        when(passwordEncoder.matches("correta", gerente.getSenhaHash())).thenReturn(true);
        AutorizacaoDescontoResponse resp = service.autorizar(
                request("25", "correta"), LOJA_ID, SOLICITANTE_ID, "10.0.0.1", "test");

        assertThat(resp.rateLimitExcedido()).isTrue();
        assertThat(resp.autorizado()).isFalse();
        // nenhum BCrypt extra rodou na tentativa bloqueada (o PIN correto nem foi testado)
        verify(passwordEncoder, never()).matches("correta", gerente.getSenhaHash());
        // a tentativa bloqueada também vira auditoria (motivo RATE_LIMIT) — append-only
        verify(logAuditoriaRepository, times(6)).save(any(LogAuditoria.class));
    }

    @Test
    @DisplayName("PIN curto ou ausente nega de forma genérica e conta como falha")
    void pinCurtoNegaSemChamarEncoder() {
        AutorizacaoDescontoResponse resp = service.autorizar(request("20", "123"), LOJA_ID, SOLICITANTE_ID, "10.0.0.1", "test");

        assertThat(resp.autorizado()).isFalse();
        assertThat(resp.mensagem()).isEqualTo(AutorizacaoDescontoService.MENSAGEM_NEGADO);
        verifyNoInteractions(usuarioRepository, passwordEncoder);
        verify(logAuditoriaRepository).save(any(LogAuditoria.class));
        // falha contabilizada: a 6ª tentativa seguinte estoura a janela
        for (int i = 0; i < 4; i++) {
            service.autorizar(request("20", null), LOJA_ID, SOLICITANTE_ID, "10.0.0.1", "test");
        }
        assertThat(rateLimiter.excedeuLimite(LOJA_ID + ":" + SOLICITANTE_ID)).isTrue();
    }

    @Test
    @DisplayName("Never registra auditoria para desconto dentro do limite")
    void semPinNaoGeraAuditoria() {
        service.autorizar(request("14.99", "qualquer-coisa"), LOJA_ID, SOLICITANTE_ID, "10.0.0.1", "test");
        verify(logAuditoriaRepository, never()).save(any());
    }
}