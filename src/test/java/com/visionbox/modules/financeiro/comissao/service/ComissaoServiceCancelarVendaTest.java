package com.visionbox.modules.financeiro.comissao.service;

import com.visionbox.modules.financeiro.comissao.domain.ComissaoLancamento;
import com.visionbox.modules.financeiro.comissao.mapper.ComissaoMapper;
import com.visionbox.modules.financeiro.comissao.repository.ComissaoConfigRepository;
import com.visionbox.modules.financeiro.comissao.repository.ComissaoLancamentoRepository;
import com.visionbox.modules.usuario.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Estorno de comissão no cancelamento da venda (§3.6 — follow-up D-017):
 * PENDENTE → CANCELADO; PAGO intocado (pendência de folha); sem lançamentos = no-op.
 */
@DisplayName("ComissaoService.cancelarPorVenda — estorno no cancelamento da venda (D-017)")
class ComissaoServiceCancelarVendaTest {

    private static final UUID LOJA = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID VENDA = UUID.randomUUID();
    private static final UUID OUTRA_LOJA = UUID.fromString("00000000-0000-0000-0000-000000000002");

    private ComissaoLancamentoRepository lancamentoRepository;
    private ComissaoService service;
    private final List<List<ComissaoLancamento>> savedBatches = new java.util.ArrayList<>();

    @BeforeEach
    void setUp() {
        ComissaoConfigRepository configRepository = mock(ComissaoConfigRepository.class);
        lancamentoRepository = mock(ComissaoLancamentoRepository.class);
        UsuarioRepository usuarioRepository = mock(UsuarioRepository.class);
        ComissaoMapper mapper = mock(ComissaoMapper.class);

        service = new ComissaoService(configRepository, lancamentoRepository, usuarioRepository, mapper);
        savedBatches.clear();

        when(lancamentoRepository.saveAll(anyList())).thenAnswer(inv -> {
            List<ComissaoLancamento> lote = inv.getArgument(0);
            savedBatches.add(lote);
            return lote;
        });
        // default: nenhuma comissão — quem stuba por venda sobrescreve
        when(lancamentoRepository.findByLojaIdAndVendaIdAndAtivoTrue(any(), any()))
                .thenReturn(List.of());
    }

    private ComissaoLancamento lancamento(ComissaoLancamento.StatusComissao status) {
        ComissaoLancamento l = ComissaoLancamento.builder()
                .lojaId(LOJA)
                .vendaId(VENDA)
                .vendaNumero("OS-2026-00001")
                .vendedorId(UUID.randomUUID())
                .vendedorNome("Joao")
                .baseCalculo(new BigDecimal("1000.00"))
                .percentualAplicado(new BigDecimal("5.00"))
                .valorComissao(new BigDecimal("50.00"))
                .status(status)
                .build();
        l.setId(UUID.randomUUID());
        return l;
    }

    @Test
    @DisplayName("Marca PENDENTE → CANCELADO e NÃO toca PAGO (dinheiro já pago ao vendedor)")
    void marcaPendenteComoCanceladoENaoTocaPago() {
        ComissaoLancamento pendente1 = lancamento(ComissaoLancamento.StatusComissao.PENDENTE);
        ComissaoLancamento pendente2 = lancamento(ComissaoLancamento.StatusComissao.PENDENTE);
        ComissaoLancamento pago = lancamento(ComissaoLancamento.StatusComissao.PAGO);
        ComissaoLancamento jaCancelado = lancamento(ComissaoLancamento.StatusComissao.CANCELADO);
        when(lancamentoRepository.findByLojaIdAndVendaIdAndAtivoTrue(LOJA, VENDA))
                .thenReturn(List.of(pendente1, pago, pendente2, jaCancelado));

        int estornadas = service.cancelarPorVenda(LOJA, VENDA, "Cliente desistiu");

        assertThat(estornadas).isEqualTo(2);
        assertThat(savedBatches).hasSize(1);
        List<ComissaoLancamento> salvos = savedBatches.get(0);
        assertThat(salvos).containsExactlyInAnyOrder(pendente1, pendente2);
        assertThat(salvos).allSatisfy(l ->
                assertThat(l.getStatus()).isEqualTo(ComissaoLancamento.StatusComissao.CANCELADO));
        // PAGO e CANCELADO anteriores permanecem como estavam
        assertThat(pago.getStatus()).isEqualTo(ComissaoLancamento.StatusComissao.PAGO);
        assertThat(jaCancelado.getStatus()).isEqualTo(ComissaoLancamento.StatusComissao.CANCELADO);
    }

    @Test
    @DisplayName("Venda só com comissão PAGO: estorna 0, não salva nada, PAGO intocado (pendência de folha)")
    void vendaSoComComissaoPagoNaoEstornaNada() {
        ComissaoLancamento pago = lancamento(ComissaoLancamento.StatusComissao.PAGO);
        when(lancamentoRepository.findByLojaIdAndVendaIdAndAtivoTrue(LOJA, VENDA))
                .thenReturn(List.of(pago));

        int estornadas = service.cancelarPorVenda(LOJA, VENDA, "devolução");

        assertThat(estornadas).isZero();
        verify(lancamentoRepository, never()).saveAll(anyList());
        assertThat(pago.getStatus()).isEqualTo(ComissaoLancamento.StatusComissao.PAGO);
    }

    @Test
    @DisplayName("Sem lançamentos: no-op sem erro (retorna 0, não salva)")
    void semLancamentosNoOpSemErro() {
        when(lancamentoRepository.findByLojaIdAndVendaIdAndAtivoTrue(LOJA, VENDA))
                .thenReturn(List.of());

        int estornadas = service.cancelarPorVenda(LOJA, VENDA, "motivo");

        assertThat(estornadas).isZero();
        verify(lancamentoRepository, never()).saveAll(anyList());
    }

    @Test
    @DisplayName("Idempotente: segunda chamada (pós-estorno) não encontra PENDENTE → 0 sem erro")
    void segundaChamadaNoOp() {
        ComissaoLancamento pendente = lancamento(ComissaoLancamento.StatusComissao.PENDENTE);
        when(lancamentoRepository.findByLojaIdAndVendaIdAndAtivoTrue(LOJA, VENDA))
                .thenReturn(List.of(pendente))
                .thenReturn(List.of()); // segunda chamada: já está CANCELADO

        assertThat(service.cancelarPorVenda(LOJA, VENDA, "1º cancelamento")).isEqualTo(1);
        assertThat(service.cancelarPorVenda(LOJA, VENDA, "replay")).isZero();
        assertThat(savedBatches).hasSize(1); // só o primeiro estorno salvou
    }

    @Test
    @DisplayName("R1: query escopada por loja — outra loja não vê lançamentos da venda")
    void queryEscopadaPorLoja() {
        when(lancamentoRepository.findByLojaIdAndVendaIdAndAtivoTrue(LOJA, VENDA))
                .thenReturn(List.of(lancamento(ComissaoLancamento.StatusComissao.PENDENTE)));

        // chamada escopada em OUTRA_LOJA: o service consulta com o lojaId recebido (R1),
        // que no mock não tem stub → lista vazia → 0 estornos
        int estornadas = service.cancelarPorVenda(OUTRA_LOJA, VENDA, "outra loja");

        assertThat(estornadas).isZero();
        verify(lancamentoRepository).findByLojaIdAndVendaIdAndAtivoTrue(OUTRA_LOJA, VENDA);
        verify(lancamentoRepository, never()).saveAll(anyList());
    }

    @Test
    @DisplayName("lojaId/vendaId nulos: retorna 0 sem tocar o repositório")
    void idsNulosNoOp() {
        assertThat(service.cancelarPorVenda(null, VENDA, "m")).isZero();
        assertThat(service.cancelarPorVenda(LOJA, null, "m")).isZero();
        verify(lancamentoRepository, never()).findByLojaIdAndVendaIdAndAtivoTrue(any(), any());
    }
}
