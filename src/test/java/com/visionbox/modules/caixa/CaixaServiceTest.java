package com.visionbox.modules.caixa;

import com.visionbox.modules.caixa.domain.CaixaMovimento;
import com.visionbox.modules.caixa.domain.CaixaSessao;
import com.visionbox.modules.caixa.dto.CaixaDTOs.*;
import com.visionbox.modules.caixa.repository.CaixaMovimentoRepository;
import com.visionbox.modules.caixa.repository.CaixaSessaoRepository;
import com.visionbox.modules.caixa.service.CaixaService;
import com.visionbox.shared.error.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CaixaServiceTest {

    @Mock
    private CaixaSessaoRepository sessaoRepository;

    @Mock
    private CaixaMovimentoRepository movimentoRepository;

    @InjectMocks
    private CaixaService caixaService;

    private UUID lojaId;
    private UUID usuarioId;

    @BeforeEach
    void setUp() {
        lojaId = UUID.randomUUID();
        usuarioId = UUID.randomUUID();
    }

    @Test
    @DisplayName("Deve abrir sessão de caixa com sucesso e registrar fundo de troco")
    void deveAbrirCaixaComSucesso() {
        when(sessaoRepository.findSessaoAbertaAtual(lojaId)).thenReturn(Optional.empty());
        when(sessaoRepository.save(any(CaixaSessao.class))).thenAnswer(inv -> {
            CaixaSessao s = inv.getArgument(0);
            s.setId(UUID.randomUUID());
            return s;
        });

        AbrirCaixaRequest req = new AbrirCaixaRequest(
                new BigDecimal("150.00"),
                "CAIXA_01",
                "Carlos Operador"
        );

        CaixaSessaoDTO dto = caixaService.abrirCaixa(lojaId, usuarioId, req);

        assertThat(dto).isNotNull();
        assertThat(dto.status()).isEqualTo(CaixaSessao.StatusCaixa.ABERTO);
        assertThat(dto.saldoInicial()).isEqualByComparingTo("150.00");
        assertThat(dto.saldoEsperado()).isEqualByComparingTo("150.00");
        verify(movimentoRepository, times(1)).save(any(CaixaMovimento.class));
    }

    @Test
    @DisplayName("Deve impedir abertura de segundo caixa se já houver um aberto")
    void deveImpedirAberturaDuplicada() {
        CaixaSessao sessaoAberta = CaixaSessao.builder()
                .id(UUID.randomUUID())
                .lojaId(lojaId)
                .status(CaixaSessao.StatusCaixa.ABERTO)
                .build();

        when(sessaoRepository.findSessaoAbertaAtual(lojaId)).thenReturn(Optional.of(sessaoAberta));

        AbrirCaixaRequest req = new AbrirCaixaRequest(BigDecimal.TEN, "CAIXA_01", "Op");

        assertThatThrownBy(() -> caixaService.abrirCaixa(lojaId, usuarioId, req))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Já existe uma sessão de caixa aberta");
    }

    @Test
    @DisplayName("Deve registrar sangria e abater do saldo esperado")
    void deveRegistrarSangria() {
        CaixaSessao sessao = CaixaSessao.builder()
                .id(UUID.randomUUID())
                .lojaId(lojaId)
                .status(CaixaSessao.StatusCaixa.ABERTO)
                .saldoInicial(new BigDecimal("200.00"))
                .saldoEsperado(new BigDecimal("200.00"))
                .totalEntradas(BigDecimal.ZERO)
                .totalSaidas(BigDecimal.ZERO)
                .movimentos(new ArrayList<>())
                .build();

        when(sessaoRepository.findSessaoAbertaAtual(lojaId)).thenReturn(Optional.of(sessao));
        when(sessaoRepository.save(any(CaixaSessao.class))).thenReturn(sessao);

        MovimentarCaixaRequest req = new MovimentarCaixaRequest(
                CaixaMovimento.TipoMovimento.SANGRIA,
                new BigDecimal("50.00"),
                "DINHEIRO",
                "Depósito no cofre",
                "Gerente"
        );

        CaixaSessaoDTO dto = caixaService.movimentar(lojaId, req);

        assertThat(dto.saldoEsperado()).isEqualByComparingTo("150.00");
        assertThat(dto.totalSaidas()).isEqualByComparingTo("50.00");
        verify(movimentoRepository).save(any(CaixaMovimento.class));
    }

    @Test
    @DisplayName("Deve fechar caixa e calcular diferença de conferência")
    void deveFecharCaixaComDiferenca() {
        CaixaSessao sessao = CaixaSessao.builder()
                .id(UUID.randomUUID())
                .lojaId(lojaId)
                .status(CaixaSessao.StatusCaixa.ABERTO)
                .saldoInicial(new BigDecimal("100.00"))
                .saldoEsperado(new BigDecimal("100.00"))
                .totalEntradas(BigDecimal.ZERO)
                .totalSaidas(BigDecimal.ZERO)
                .movimentos(new ArrayList<>())
                .build();

        when(sessaoRepository.findSessaoAbertaAtual(lojaId)).thenReturn(Optional.of(sessao));
        when(sessaoRepository.save(any(CaixaSessao.class))).thenAnswer(inv -> inv.getArgument(0));

        FecharCaixaRequest req = new FecharCaixaRequest(
                new BigDecimal("98.00"),
                "Falta de R$ 2,00 no troco"
        );

        CaixaSessaoDTO dto = caixaService.fecharCaixa(lojaId, req);

        assertThat(dto.status()).isEqualTo(CaixaSessao.StatusCaixa.FECHADO);
        assertThat(dto.saldoInformadoFechamento()).isEqualByComparingTo("98.00");
        assertThat(dto.diferencaFechamento()).isEqualByComparingTo("-2.00");
        verify(movimentoRepository).save(any(CaixaMovimento.class));
    }
}
