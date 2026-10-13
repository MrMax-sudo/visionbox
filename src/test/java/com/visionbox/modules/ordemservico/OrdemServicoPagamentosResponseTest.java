package com.visionbox.modules.ordemservico;

import com.visionbox.modules.financeiro.comissao.service.ComissaoService;
import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento;
import com.visionbox.modules.financeiro.formapagamento.repository.FormaPagamentoRepository;
import com.visionbox.modules.financeiro.maquininha.service.MdrCalculoService;
import com.visionbox.modules.ordemservico.domain.OrdemServico;
import com.visionbox.modules.ordemservico.domain.OrdemServicoPagamento;
import com.visionbox.modules.ordemservico.domain.StatusOS;
import com.visionbox.modules.ordemservico.domain.TransicaoOSRegistry;
import com.visionbox.modules.ordemservico.dto.OrdemServicoRequest;
import com.visionbox.modules.ordemservico.dto.OrdemServicoResponse;
import com.visionbox.modules.ordemservico.mapper.OrdemServicoMapper;
import com.visionbox.modules.ordemservico.repository.OrdemServicoPagamentoRepository;
import com.visionbox.modules.ordemservico.repository.OrdemServicoRepository;
import com.visionbox.modules.ordemservico.service.OrdemServicoService;
import com.visionbox.shared.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Contrato de {@code OrdemServicoResponse.pagamentos[]} (§3.5): taxa/liquido/parcelas/
 * maquininha por linha, tri-state null preservado (V37), nome por snapshot com fallback
 * em lote, e ZERO N+1 — uma única query de pagamento para o single e para a página.
 */
@DisplayName("OrdemServicoService — response pagamentos[] sem N+1 (contrato fixo)")
class OrdemServicoPagamentosResponseTest {

    private static final UUID LOJA_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID CLIENTE_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID FORMA_CREDITO_ID = UUID.fromString("66666666-6666-6666-6666-666666666666");
    private static final UUID MAQ_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");

    private OrdemServicoRepository repository;
    private OrdemServicoPagamentoRepository pagamentoRepository;
    private FormaPagamentoRepository formaPagamentoRepository;
    private MdrCalculoService mdrCalculoService;
    private OrdemServicoService service;

    @BeforeEach
    void setUp() {
        repository = mock(OrdemServicoRepository.class);
        pagamentoRepository = mock(OrdemServicoPagamentoRepository.class);
        formaPagamentoRepository = mock(FormaPagamentoRepository.class);
        mdrCalculoService = mock(MdrCalculoService.class);

        OrdemServicoMapper mapper = new OrdemServicoMapper() {
            @Override
            public OrdemServicoResponse toResponse(OrdemServico entity) {
                return OrdemServicoResponse.builder()
                        .id(entity.getId())
                        .lojaId(entity.getLojaId())
                        .numero(entity.getNumero())
                        .status(entity.getStatus() != null ? entity.getStatus().name() : null)
                        .clienteId(entity.getClienteId())
                        .build();
            }
        };
        Clock clock = Clock.fixed(Instant.parse("2026-10-13T12:00:00Z"), ZoneOffset.UTC);

        service = new OrdemServicoService(
                new TransicaoOSRegistry(),
                repository,
                mapper,
                clock,
                null, // estoqueService
                null, // contaReceberService
                null, // produtoRepository
                pagamentoRepository,
                formaPagamentoRepository,
                null, // clienteRepository
                null, // slaMetrics
                null, // rastreioTokenService
                null, // autorizacaoDescontoService
                null, // maquininhaRepository
                mdrCalculoService,
                mock(ComissaoService.class)
        );

        TenantContext.setCurrentLojaId(LOJA_ID);

        when(repository.save(any(OrdemServico.class))).thenAnswer(inv -> {
            OrdemServico os = inv.getArgument(0);
            if (os.getId() == null) os.setId(UUID.randomUUID());
            return os;
        });
        when(pagamentoRepository.save(any(OrdemServicoPagamento.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(pagamentoRepository.findAllByLojaIdAndOrdemServicoIdIn(any(), anyCollection()))
                .thenReturn(List.of());
        when(formaPagamentoRepository.findByLojaIdAndIdIn(any(), anyCollection()))
                .thenReturn(List.of());
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ------------------------------------------------------------------
    // Contrato pagamentos[] no single (buscar/criar)
    // ------------------------------------------------------------------

    @Test
    @DisplayName("buscar: pagamentos[] com id/forma/nome(snapshot)/valor/taxa/liquido/maquininha/parcelas")
    void buscarAnexaPagamentosComContratoCompleto() {
        UUID osId = UUID.randomUUID();
        OrdemServico os = os(osId, StatusOS.PEDIDO_CONFIRMADO);
        when(repository.findByIdAndLojaId(osId, LOJA_ID)).thenReturn(java.util.Optional.of(os));
        OrdemServicoPagamento pg = pagamento(osId, "Crédito 3x", new BigDecimal("300.00"),
                new BigDecimal("14.97"), new BigDecimal("285.03"), MAQ_ID, 3);
        when(pagamentoRepository.findAllByLojaIdAndOrdemServicoIdIn(LOJA_ID, List.of(osId)))
                .thenReturn(List.of(pg));

        OrdemServicoResponse resp = service.buscar(osId);

        assertThat(resp.getPagamentos()).hasSize(1);
        OrdemServicoResponse.PagamentoResponse p = resp.getPagamentos().get(0);
        assertThat(p.getId()).isEqualTo(pg.getId());
        assertThat(p.getFormaPagamentoId()).isEqualTo(FORMA_CREDITO_ID);
        assertThat(p.getFormaPagamentoNome()).isEqualTo("Crédito 3x"); // snapshot da linha
        assertThat(p.getValor()).isEqualByComparingTo(new BigDecimal("300.00"));
        assertThat(p.getTaxaValor()).isEqualByComparingTo(new BigDecimal("14.97"));
        assertThat(p.getValorLiquido()).isEqualByComparingTo(new BigDecimal("285.03"));
        assertThat(p.getMaquininhaId()).isEqualTo(MAQ_ID);
        assertThat(p.getParcelas()).isEqualTo(3);
    }

    @Test
    @DisplayName("MDR pendente (V37 tri-state): taxaValor/valorLiquido/maquininhaId serializam null")
    void mdrPendentePreservaTriStateNulo() {
        UUID osId = UUID.randomUUID();
        when(repository.findByIdAndLojaId(osId, LOJA_ID))
                .thenReturn(java.util.Optional.of(os(osId, StatusOS.PEDIDO_CONFIRMADO)));
        when(pagamentoRepository.findAllByLojaIdAndOrdemServicoIdIn(LOJA_ID, List.of(osId)))
                .thenReturn(List.of(pagamento(osId, null, new BigDecimal("300.00"), null, null, null, 3)));

        OrdemServicoResponse resp = service.buscar(osId);

        OrdemServicoResponse.PagamentoResponse p = resp.getPagamentos().get(0);
        assertThat(p.getTaxaValor()).isNull();
        assertThat(p.getValorLiquido()).isNull();
        assertThat(p.getMaquininhaId()).isNull();
        assertThat(p.getValor()).isEqualByComparingTo(new BigDecimal("300.00"));
        assertThat(p.getParcelas()).isEqualTo(3);
    }

    @Test
    @DisplayName("Snapshot de nome ausente: resolve por formaPagamentoId em LOTE (uma query)")
    void nomeAusenteResolvidoEmLotePorFormaId() {
        UUID osId = UUID.randomUUID();
        when(repository.findByIdAndLojaId(osId, LOJA_ID))
                .thenReturn(java.util.Optional.of(os(osId, StatusOS.PEDIDO_CONFIRMADO)));
        OrdemServicoPagamento pg = pagamento(osId, null, new BigDecimal("150.00"),
                BigDecimal.ZERO, new BigDecimal("150.00"), null, 1);
        when(pagamentoRepository.findAllByLojaIdAndOrdemServicoIdIn(LOJA_ID, List.of(osId)))
                .thenReturn(List.of(pg));
        FormaPagamento forma = FormaPagamento.builder().nome("Dinheiro").build();
        forma.setId(FORMA_CREDITO_ID);
        forma.setLojaId(LOJA_ID);
        when(formaPagamentoRepository.findByLojaIdAndIdIn(LOJA_ID, java.util.Set.of(FORMA_CREDITO_ID)))
                .thenReturn(List.of(forma));

        OrdemServicoResponse resp = service.buscar(osId);

        assertThat(resp.getPagamentos().get(0).getFormaPagamentoNome()).isEqualTo("Dinheiro");
        verify(formaPagamentoRepository, times(1)).findByLojaIdAndIdIn(LOJA_ID, java.util.Set.of(FORMA_CREDITO_ID));
        verify(formaPagamentoRepository, never()).findByIdAndLojaId(any(), any()); // sem per-pagamento
    }

    @Test
    @DisplayName("OS sem pagamentos: pagamentos = [] (array vazio, contrato estável)")
    void osSemPagamentosRetornaListaVazia() {
        UUID osId = UUID.randomUUID();
        when(repository.findByIdAndLojaId(osId, LOJA_ID))
                .thenReturn(java.util.Optional.of(os(osId, StatusOS.ORCAMENTO)));

        OrdemServicoResponse resp = service.buscar(osId);

        assertThat(resp.getPagamentos()).isNotNull().isEmpty();
    }

    // ------------------------------------------------------------------
    // N+1 proibido — página inteira em UMA query de pagamento
    // ------------------------------------------------------------------

    @Test
    @DisplayName("listar: página com 3 OS usa UMA única query em lote (findAll...IdIn), nunca por OS")
    void listarSemNPlusUm() {
        OrdemServico os1 = os(UUID.randomUUID(), StatusOS.PEDIDO_CONFIRMADO);
        OrdemServico os2 = os(UUID.randomUUID(), StatusOS.ORCAMENTO);
        OrdemServico os3 = os(UUID.randomUUID(), StatusOS.ENTREGUE);
        when(repository.findAllByLojaId(LOJA_ID, PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(List.of(os1, os2, os3)));
        when(pagamentoRepository.findAllByLojaIdAndOrdemServicoIdIn(any(), anyCollection()))
                .thenReturn(List.of(
                        pagamento(os1.getId(), "Crédito 3x", new BigDecimal("300.00"),
                                new BigDecimal("14.97"), new BigDecimal("285.03"), MAQ_ID, 3),
                        pagamento(os3.getId(), "PIX", new BigDecimal("100.00"),
                                BigDecimal.ZERO, new BigDecimal("100.00"), null, 1)));

        var page = service.listar(null, PageRequest.of(0, 20));

        assertThat(page.getContent()).hasSize(3);
        // UMA query para a página toda — findBy...OrdemServicoIdIn nunca por-OS
        verify(pagamentoRepository, times(1)).findAllByLojaIdAndOrdemServicoIdIn(eq(LOJA_ID), anyCollection());
        verify(pagamentoRepository, never()).findAllByOrdemServicoIdAndLojaId(any(), any());

        var p1 = page.getContent().get(0).getPagamentos();
        assertThat(p1).hasSize(1);
        assertThat(p1.get(0).getValorLiquido()).isEqualByComparingTo(new BigDecimal("285.03"));
        assertThat(p1.get(0).getParcelas()).isEqualTo(3);
        assertThat(page.getContent().get(1).getPagamentos()).isEmpty();
        var p3 = page.getContent().get(2).getPagamentos();
        assertThat(p3).hasSize(1);
        assertThat(p3.get(0).getFormaPagamentoNome()).isEqualTo("PIX");
        assertThat(p3.get(0).getParcelas()).isEqualTo(1);
    }

    @Test
    @DisplayName("criar: crédito 3x persiste parcelas=3 e anexa pagamentos à resposta (1 lote)")
    void criarPersisteParcelasEAnexaNaResposta() {
        FormaPagamento credito = FormaPagamento.builder()
                .nome("Crédito")
                .tipo(FormaPagamento.TipoFormaPagamento.CREDITO)
                .ativo(true)
                .permiteParcelar(true)
                .build();
        credito.setId(FORMA_CREDITO_ID);
        credito.setLojaId(LOJA_ID);
        when(formaPagamentoRepository.findByIdAndLojaId(FORMA_CREDITO_ID, LOJA_ID))
                .thenReturn(java.util.Optional.of(credito));

        // simula a mesma transação: save() persiste e o lote da resposta devolve o que foi salvo
        List<OrdemServicoPagamento> salvosNaTx = new java.util.ArrayList<>();
        when(pagamentoRepository.save(any(OrdemServicoPagamento.class))).thenAnswer(inv -> {
            OrdemServicoPagamento p = inv.getArgument(0);
            if (p.getId() == null) p.setId(UUID.randomUUID());
            salvosNaTx.add(p);
            return p;
        });
        when(pagamentoRepository.findAllByLojaIdAndOrdemServicoIdIn(any(), anyCollection()))
                .thenAnswer(inv -> salvosNaTx);

        OrdemServicoResponse resp = service.criar(OrdemServicoRequest.builder()
                .clienteId(CLIENTE_ID)
                .pagamentos(List.of(OrdemServicoRequest.PagamentoRequest.builder()
                        .formaPagamentoId(FORMA_CREDITO_ID)
                        .valor(new BigDecimal("300.00"))
                        .parcelas(3)
                        .build()))
                .build());

        // persistiu parcelas na linha de pagamento (V40)
        assertThat(salvosNaTx).hasSize(1);
        assertThat(salvosNaTx.get(0).getParcelas()).isEqualTo(3);

        // resposta do fluxo de criação anexa o pagamento recém-persistido — 1 query em lote
        verify(pagamentoRepository, times(1)).findAllByLojaIdAndOrdemServicoIdIn(eq(LOJA_ID), anyCollection());
        verify(pagamentoRepository, never()).findAllByOrdemServicoIdAndLojaId(any(), any());
        assertThat(resp.getPagamentos()).hasSize(1);
        OrdemServicoResponse.PagamentoResponse p = resp.getPagamentos().get(0);
        assertThat(p.getParcelas()).isEqualTo(3);
        assertThat(p.getFormaPagamentoNome()).isEqualTo("Crédito"); // snapshot persistido na criação
        assertThat(p.getValor()).isEqualByComparingTo(new BigDecimal("300.00"));
        // maquininhaRepository ausente no setup → MDR pendente: tri-state null preservado
        assertThat(p.getTaxaValor()).isNull();
        assertThat(p.getValorLiquido()).isNull();
        assertThat(p.getMaquininhaId()).isNull();
    }

    @Test
    @DisplayName("criar: débito (não-cartão parcelável ausente) persiste parcelas=1")
    void criarDebitoPersisteParcelasUm() {
        FormaPagamento debito = FormaPagamento.builder()
                .nome("Débito")
                .tipo(FormaPagamento.TipoFormaPagamento.DEBITO)
                .ativo(true)
                .permiteParcelar(false)
                .build();
        debito.setId(FORMA_CREDITO_ID);
        debito.setLojaId(LOJA_ID);
        when(formaPagamentoRepository.findByIdAndLojaId(FORMA_CREDITO_ID, LOJA_ID))
                .thenReturn(java.util.Optional.of(debito));

        service.criar(OrdemServicoRequest.builder()
                .clienteId(CLIENTE_ID)
                .pagamentos(List.of(OrdemServicoRequest.PagamentoRequest.builder()
                        .formaPagamentoId(FORMA_CREDITO_ID)
                        .valor(new BigDecimal("200.00"))
                        .parcelas(7) // débito ignora — sempre 1
                        .build()))
                .build());

        ArgumentCaptor<OrdemServicoPagamento> captor = ArgumentCaptor.forClass(OrdemServicoPagamento.class);
        verify(pagamentoRepository).save(captor.capture());
        assertThat(captor.getValue().getParcelas()).isEqualTo(1);
    }

    // ------------------------------------------------------------------
    // Fixtures
    // ------------------------------------------------------------------

    private OrdemServico os(UUID id, StatusOS status) {
        OrdemServico os = OrdemServico.builder()
                .lojaId(LOJA_ID)
                .numero("OS-2026-00001")
                .clienteId(CLIENTE_ID)
                .status(status)
                .build();
        os.setId(id);
        return os;
    }

    private OrdemServicoPagamento pagamento(UUID osId, String nomeSnapshot, BigDecimal valor,
                                           BigDecimal taxa, BigDecimal liquido, UUID maquininhaId, int parcelas) {
        OrdemServicoPagamento p = OrdemServicoPagamento.builder()
                .lojaId(LOJA_ID)
                .ordemServicoId(osId)
                .formaPagamentoId(FORMA_CREDITO_ID)
                .formaPagamentoNome(nomeSnapshot)
                .valor(valor)
                .taxaValor(taxa)
                .valorLiquido(liquido)
                .maquininhaId(maquininhaId)
                .parcelas(parcelas)
                .build();
        p.setId(UUID.randomUUID());
        return p;
    }
}
