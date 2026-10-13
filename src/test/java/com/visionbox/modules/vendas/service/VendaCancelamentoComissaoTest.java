package com.visionbox.modules.vendas.service;

import com.visionbox.modules.financeiro.comissao.service.ComissaoService;
import com.visionbox.modules.ordemservico.domain.OrdemServico;
import com.visionbox.modules.ordemservico.domain.StatusOS;
import com.visionbox.modules.ordemservico.domain.TransicaoOSRegistry;
import com.visionbox.modules.ordemservico.repository.OrdemServicoRepository;
import com.visionbox.modules.vendas.dto.CancelarVendaRequest;
import com.visionbox.modules.vendas.dto.VendaViewDTO;
import com.visionbox.shared.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Cancelamento de venda (POST /api/v1/vendas/{id}/cancelar →
 * VendaHistoricoService.cancelar): estorna as comissões PENDENTES da venda
 * (follow-up D-017) com lojaId+vendaId+motivo do request. Falha no estorno
 * NUNCA quebra o cancelamento (try/catch WARN — mesmo padrão do estoque e
 * das contas a receber do próprio método).
 */
@DisplayName("VendaHistoricoService.cancelar — estorno de comissão PENDENTE (D-017)")
class VendaCancelamentoComissaoTest {

    private static final UUID LOJA_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID CLIENTE_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    private OrdemServicoRepository ordemServicoRepository;
    private ComissaoService comissaoService;
    private VendaHistoricoService service;

    @BeforeEach
    void setUp() {
        ordemServicoRepository = mock(OrdemServicoRepository.class);
        comissaoService = mock(ComissaoService.class);

        service = new VendaHistoricoService(
                ordemServicoRepository,
                null, // pagamentoRepository
                null, // documentoFiscalRepository
                null, // contaReceberRepository
                null, // clienteRepository
                null, // produtoRepository
                new TransicaoOSRegistry(),
                null, // estoqueService
                comissaoService,
                Clock.fixed(Instant.parse("2026-10-13T12:00:00Z"), ZoneOffset.UTC)
        );

        TenantContext.setCurrentLojaId(LOJA_ID);

        when(ordemServicoRepository.save(any(OrdemServico.class))).thenAnswer(inv -> {
            OrdemServico os = inv.getArgument(0);
            if (os.getId() == null) os.setId(UUID.randomUUID());
            return os;
        });
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    private OrdemServico vendaAtiva() {
        OrdemServico os = OrdemServico.builder()
                .lojaId(LOJA_ID)
                .numero("OS-2026-00042")
                .clienteId(CLIENTE_ID)
                .status(StatusOS.PEDIDO_CONFIRMADO)
                .build();
        os.setId(UUID.randomUUID());
        return os;
    }

    @Test
    @DisplayName("Cancela venda e estorna comissões PENDENTES com lojaId+vendaId+motivo (R1)")
    void cancelarEstornaComissoesPendentesDaVenda() {
        OrdemServico os = vendaAtiva();
        when(ordemServicoRepository.findByIdAndLojaId(os.getId(), LOJA_ID)).thenReturn(Optional.of(os));

        VendaViewDTO dto = service.cancelar(os.getId(),
                CancelarVendaRequest.builder().motivo("Cliente desistiu").build());

        assertThat(dto).isNotNull();
        assertThat(dto.getStatus()).isEqualTo("CANCELADO");
        verify(comissaoService).cancelarPorVenda(LOJA_ID, os.getId(), "Cliente desistiu");
    }

    @Test
    @DisplayName("Falha no estorno NUNCA quebra o cancelamento: venda cancelada mesmo assim")
    void falhaNoEstornoNaoQuebraCancelamento() {
        OrdemServico os = vendaAtiva();
        when(ordemServicoRepository.findByIdAndLojaId(os.getId(), LOJA_ID)).thenReturn(Optional.of(os));
        doThrow(new RuntimeException("boom na comissão")).when(comissaoService)
                .cancelarPorVenda(any(), any(), anyString());

        VendaViewDTO dto = service.cancelar(os.getId(),
                CancelarVendaRequest.builder().motivo("devolução").build());

        assertThat(dto.getStatus()).isEqualTo("CANCELADO"); // cancelamento persistiu
        verify(ordemServicoRepository).save(any(OrdemServico.class)); // venda salva cancelada
    }

    @Test
    @DisplayName("ComissaoService ausente (perfil leve): cancelamento no-op, sem NPE")
    void cancelarSemComissaoServiceNoOp() {
        VendaHistoricoService servicoSemComissao = new VendaHistoricoService(
                ordemServicoRepository, null, null, null, null, null,
                new TransicaoOSRegistry(), null, null,
                Clock.fixed(Instant.parse("2026-10-13T12:00:00Z"), ZoneOffset.UTC));
        OrdemServico os = vendaAtiva();
        when(ordemServicoRepository.findByIdAndLojaId(os.getId(), LOJA_ID)).thenReturn(Optional.of(os));

        VendaViewDTO dto = servicoSemComissao.cancelar(os.getId(),
                CancelarVendaRequest.builder().motivo("motivo").build());

        assertThat(dto.getStatus()).isEqualTo("CANCELADO"); // segue sem NPE
    }

    @Test
    @DisplayName("Venda já cancelada: rejeita ANTES de qualquer estorno de comissão")
    void cancelarVendaJaCanceladaRejeitaAntesDoEstorno() {
        OrdemServico os = vendaAtiva();
        os.setStatus(StatusOS.CANCELADO);
        when(ordemServicoRepository.findByIdAndLojaId(os.getId(), LOJA_ID)).thenReturn(Optional.of(os));

        assertThatThrownBy(() -> service.cancelar(os.getId(),
                CancelarVendaRequest.builder().motivo("de novo?").build()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("já está cancelada");

        verify(comissaoService, never()).cancelarPorVenda(any(), any(), any());
    }
}
