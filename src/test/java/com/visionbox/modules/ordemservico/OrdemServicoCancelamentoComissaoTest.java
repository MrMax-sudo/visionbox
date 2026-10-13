package com.visionbox.modules.ordemservico;

import com.visionbox.modules.financeiro.comissao.service.ComissaoService;
import com.visionbox.modules.ordemservico.domain.OrdemServico;
import com.visionbox.modules.ordemservico.domain.StatusOS;
import com.visionbox.modules.ordemservico.domain.TransicaoOSRegistry;
import com.visionbox.modules.ordemservico.dto.OrdemServicoResponse;
import com.visionbox.modules.ordemservico.mapper.OrdemServicoMapper;
import com.visionbox.modules.ordemservico.repository.OrdemServicoRepository;
import com.visionbox.modules.ordemservico.service.OrdemServicoService;
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
 * Cancelamento de OS via máquina de estados (PATCH /ordens-servico/{id}/status →
 * CANCELADO): estorna as comissões PENDENTES da venda (follow-up D-017 — "OS
 * cancelada após venda deixa lançamento PENDENTE"). Falha no estorno NUNCA quebra
 * a transição (try/catch WARN — mesmo padrão do estoque).
 */
@DisplayName("OrdemServicoService — cancelamento via status estorna comissão PENDENTE (D-017)")
class OrdemServicoCancelamentoComissaoTest {

    private static final UUID LOJA_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID CLIENTE_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    private OrdemServicoRepository repository;
    private ComissaoService comissaoService;
    private OrdemServicoService service;

    @BeforeEach
    void setUp() {
        repository = mock(OrdemServicoRepository.class);
        comissaoService = mock(ComissaoService.class);

        OrdemServicoMapper mapper = new OrdemServicoMapper() {
            @Override
            public OrdemServicoResponse toResponse(OrdemServico entity) {
                return OrdemServicoResponse.builder()
                        .id(entity.getId())
                        .numero(entity.getNumero())
                        .status(entity.getStatus() != null ? entity.getStatus().name() : null)
                        .clienteId(entity.getClienteId())
                        .build();
            }
        };

        service = new OrdemServicoService(
                new TransicaoOSRegistry(),
                repository,
                mapper,
                Clock.fixed(Instant.parse("2026-10-13T12:00:00Z"), ZoneOffset.UTC),
                null, // estoqueService
                null, // contaReceberService
                null, // produtoRepository
                null, // pagamentoRepository
                null, // formaPagamentoRepository
                null, // clienteRepository
                null, // slaMetrics
                null, // rastreioTokenService
                null, // autorizacaoDescontoService
                null, // maquininhaRepository
                null, // mdrCalculoService
                comissaoService
        );

        TenantContext.setCurrentLojaId(LOJA_ID);

        when(repository.save(any(OrdemServico.class))).thenAnswer(inv -> {
            OrdemServico os = inv.getArgument(0);
            if (os.getId() == null) os.setId(UUID.randomUUID());
            return os;
        });
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    private OrdemServico osPedidoConfirmado() {
        OrdemServico os = OrdemServico.builder()
                .lojaId(LOJA_ID)
                .numero("OS-2026-00001")
                .clienteId(CLIENTE_ID)
                .status(StatusOS.PEDIDO_CONFIRMADO)
                .build();
        os.setId(UUID.randomUUID());
        return os;
    }

    @Test
    @DisplayName("Transição → CANCELADO estorna comissões PENDENTES com lojaId+vendaId+motivo (R1)")
    void avancarParaCanceladoEstornaComissaoDaVenda() {
        OrdemServico os = osPedidoConfirmado();
        when(repository.findByIdAndLojaId(os.getId(), LOJA_ID)).thenReturn(Optional.of(os));

        OrdemServico resultado = service.avancar(LOJA_ID, os.getId(), StatusOS.CANCELADO,
                "gerente", "Cliente desistiu da compra");

        assertThat(resultado.getStatus()).isEqualTo(StatusOS.CANCELADO);
        verify(comissaoService).cancelarPorVenda(LOJA_ID, os.getId(), "Cliente desistiu da compra");
    }

    @Test
    @DisplayName("Motivo ausente: fallback documentado (não passa null ao estorno)")
    void avancarParaCanceladoComObservacaoNulaUsaMotivoFallback() {
        OrdemServico os = osPedidoConfirmado();
        when(repository.findByIdAndLojaId(os.getId(), LOJA_ID)).thenReturn(Optional.of(os));

        service.avancar(LOJA_ID, os.getId(), StatusOS.CANCELADO, "gerente", null);

        verify(comissaoService).cancelarPorVenda(LOJA_ID, os.getId(), "OS " + os.getNumero() + " cancelada");
    }

    @Test
    @DisplayName("Falha no estorno de comissão NUNCA quebra o cancelamento (WARN e segue)")
    void falhaNoEstornoNaoQuebraCancelamento() {
        OrdemServico os = osPedidoConfirmado();
        when(repository.findByIdAndLojaId(os.getId(), LOJA_ID)).thenReturn(Optional.of(os));
        doThrow(new RuntimeException("boom na comissão")).when(comissaoService)
                .cancelarPorVenda(any(), any(), anyString());

        OrdemServico resultado = service.avancar(LOJA_ID, os.getId(), StatusOS.CANCELADO,
                "gerente", "cliente desistiu");

        assertThat(resultado.getStatus()).isEqualTo(StatusOS.CANCELADO); // transição persistiu
        verify(repository).save(any(OrdemServico.class)); // OS cancelada salva normalmente
    }

    @Test
    @DisplayName("Transição que NÃO é cancelamento não toca comissão")
    void avancarParaOutroStatusNaoChamaComissao() {
        OrdemServico os = OrdemServico.builder()
                .lojaId(LOJA_ID).numero("OS-2026-00002")
                .clienteId(CLIENTE_ID).status(StatusOS.ORCAMENTO).build();
        os.setId(UUID.randomUUID());
        when(repository.findByIdAndLojaId(os.getId(), LOJA_ID)).thenReturn(Optional.of(os));

        service.avancar(LOJA_ID, os.getId(), StatusOS.PEDIDO_CONFIRMADO, "vendedor", "confirmado");

        verify(comissaoService, never()).cancelarPorVenda(any(), any(), any());
    }

    @Test
    @DisplayName("Transição inválida → CANCELADO rejeitada ANTES de qualquer estorno")
    void transicaoInvalidaNaoEstorna() {
        OrdemServico os = OrdemServico.builder()
                .lojaId(LOJA_ID).numero("OS-2026-00003")
                .clienteId(CLIENTE_ID).status(StatusOS.ENTREGUE).build(); // terminal
        os.setId(UUID.randomUUID());
        when(repository.findByIdAndLojaId(os.getId(), LOJA_ID)).thenReturn(Optional.of(os));

        assertThatThrownBy(() -> service.avancar(LOJA_ID, os.getId(), StatusOS.CANCELADO, "gerente", "x"))
                .isInstanceOf(com.visionbox.modules.ordemservico.domain.TransicaoInvalidaException.class);
        verify(comissaoService, never()).cancelarPorVenda(any(), any(), any());
    }
}
