package com.visionbox.modules.ordemservico;

import com.visionbox.modules.catalogo.domain.Produto;
import com.visionbox.modules.catalogo.repository.ProdutoRepository;
import com.visionbox.modules.financeiro.comissao.dto.ApurarComissaoRequest;
import com.visionbox.modules.financeiro.comissao.service.ComissaoService;
import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento;
import com.visionbox.modules.financeiro.formapagamento.repository.FormaPagamentoRepository;
import com.visionbox.modules.financeiro.maquininha.domain.MaquininhaCartao;
import com.visionbox.modules.financeiro.maquininha.repository.MaquininhaCartaoRepository;
import com.visionbox.modules.financeiro.maquininha.service.MdrCalculoServiceImpl;
import com.visionbox.modules.ordemservico.domain.OrdemServico;
import com.visionbox.modules.ordemservico.domain.OrdemServicoPagamento;
import com.visionbox.modules.ordemservico.domain.TransicaoOSRegistry;
import com.visionbox.modules.ordemservico.dto.OrdemServicoRequest;
import com.visionbox.modules.ordemservico.dto.OrdemServicoResponse;
import com.visionbox.modules.ordemservico.mapper.OrdemServicoMapper;
import com.visionbox.modules.ordemservico.repository.OrdemServicoPagamentoRepository;
import com.visionbox.modules.ordemservico.repository.OrdemServicoRepository;
import com.visionbox.modules.ordemservico.service.OrdemServicoService;
import com.visionbox.modules.usuario.domain.Perfil;
import com.visionbox.modules.usuario.domain.Usuario;
import com.visionbox.shared.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * MDR no pagamento da venda PDV (§3.5) + apuração automática de comissão na
 * finalização da venda (§3.6) — plug no fluxo de OrdemServicoService.criar.
 * <p>
 * MDR usa a implementação REAL ({@link MdrCalculoServiceImpl}) para provar a
 * fórmula/faixa (crédito 3x → faixa 2-6x; débito → taxa débito); comissão usa
 * mock de {@link ComissaoService} (idempotência interna é coberta em
 * ComissaoServiceTest).
 */
@DisplayName("OrdemServicoService — MDR no pagamento (§3.5) e comissão automática (§3.6)")
class OrdemServicoMdrComissaoTest {

    private static final UUID LOJA_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID CLIENTE_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID PRODUTO_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private static final UUID MAQ_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
    private static final UUID VENDEDOR_ID = UUID.fromString("55555555-5555-5555-5555-555555555555");
    private static final UUID FORMA_CREDITO_ID = UUID.fromString("66666666-6666-6666-6666-666666666666");
    private static final UUID FORMA_DEBITO_ID = UUID.fromString("77777777-7777-7777-7777-777777777777");
    private static final UUID FORMA_PIX_ID = UUID.fromString("88888888-8888-8888-8888-888888888888");

    private OrdemServicoRepository repository;
    private ProdutoRepository produtoRepository;
    private OrdemServicoPagamentoRepository pagamentoRepository;
    private FormaPagamentoRepository formaPagamentoRepository;
    private MaquininhaCartaoRepository maquininhaRepository;
    private ComissaoService comissaoService;
    private OrdemServicoService service;

    private MaquininhaCartao maquininha;

    @BeforeEach
    void setUp() {
        repository = mock(OrdemServicoRepository.class);
        produtoRepository = mock(ProdutoRepository.class);
        pagamentoRepository = mock(OrdemServicoPagamentoRepository.class);
        formaPagamentoRepository = mock(FormaPagamentoRepository.class);
        maquininhaRepository = mock(MaquininhaCartaoRepository.class);
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
        Clock clock = Clock.fixed(Instant.parse("2026-10-13T12:00:00Z"), ZoneOffset.UTC);

        service = new OrdemServicoService(
                new TransicaoOSRegistry(),
                repository,
                mapper,
                clock,
                null, // estoqueService
                null, // contaReceberService
                produtoRepository,
                pagamentoRepository,
                formaPagamentoRepository,
                null, // clienteRepository
                null, // slaMetrics
                null, // rastreioTokenService
                null, // autorizacaoDescontoService
                maquininhaRepository,
                new MdrCalculoServiceImpl(), // cálculo REAL (§3.5)
                comissaoService
        );

        TenantContext.setCurrentLojaId(LOJA_ID);

        maquininha = MaquininhaCartao.builder()
                .nome("Stone POS")
                .adquirente("STONE")
                .debitoTaxaPercentual(new BigDecimal("1.99"))
                .debitoTaxaFixa(new BigDecimal("0.20"))
                .credito1xTaxaPercentual(new BigDecimal("3.49"))
                .credito1xTaxaFixa(BigDecimal.ZERO)
                .credito2a6TaxaPercentual(new BigDecimal("4.99"))
                .credito2a6TaxaFixa(BigDecimal.ZERO)
                .credito7a12TaxaPercentual(new BigDecimal("7.99"))
                .credito7a12TaxaFixa(BigDecimal.ZERO)
                .build();
        maquininha.setId(MAQ_ID);
        maquininha.setLojaId(LOJA_ID);

        when(repository.save(any(OrdemServico.class))).thenAnswer(inv -> {
            OrdemServico os = inv.getArgument(0);
            if (os.getId() == null) os.setId(UUID.randomUUID());
            return os;
        });
        when(pagamentoRepository.save(any(OrdemServicoPagamento.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    // ------------------------------------------------------------------
    // MDR (§3.5)
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Crédito 3x aplica taxa da faixa 2-6x e persiste taxa/liquido/maquininha")
    void credito3xAplicaTaxaFaixa2a6() {
        quandoFormaResolvida(formaCredito(), FORMA_CREDITO_ID);
        quandoUmaMaquininhaAtiva();

        criarVendaCartao(FORMA_CREDITO_ID, new BigDecimal("300.00"), 3);

        OrdemServicoPagamento osp = capturarPagamento();
        // 300.00 * 4.99% = 14.97; liquido = 285.03 (HALF_EVEN 2 casas)
        assertThat(osp.getTaxaValor()).isEqualByComparingTo(new BigDecimal("14.97"));
        assertThat(osp.getValorLiquido()).isEqualByComparingTo(new BigDecimal("285.03"));
        assertThat(osp.getMaquininhaId()).isEqualTo(MAQ_ID);
    }

    @Test
    @DisplayName("Débito usa taxa débito (percentual + fixa), independentemente de parcelas")
    void debitoUsaTaxaDebito() {
        quandoFormaResolvida(formaDebito(), FORMA_DEBITO_ID);
        quandoUmaMaquininhaAtiva();

        OrdemServicoRequest.PagamentoRequest pg = pagamento(FORMA_DEBITO_ID, new BigDecimal("200.00"));
        criarVenda(pg);

        OrdemServicoPagamento osp = capturarPagamento();
        // 200.00 * 1.99% = 3.98 + fixa 0.20 = 4.18; liquido = 195.82
        assertThat(osp.getTaxaValor()).isEqualByComparingTo(new BigDecimal("4.18"));
        assertThat(osp.getValorLiquido()).isEqualByComparingTo(new BigDecimal("195.82"));
        assertThat(osp.getMaquininhaId()).isEqualTo(MAQ_ID);
    }

    @Test
    @DisplayName("Dinheiro/PIX não tem MDR: taxa 0 e liquido igual ao valor")
    void dinheiroPixSemMdr() {
        quandoFormaResolvida(formaPix(), FORMA_PIX_ID);
        quandoUmaMaquininhaAtiva(); // mesmo com maquininha ativa, PIX é isento

        criarVendaCartao(FORMA_PIX_ID, new BigDecimal("150.00"), null);

        OrdemServicoPagamento osp = capturarPagamento();
        assertThat(osp.getTaxaValor()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(osp.getValorLiquido()).isEqualByComparingTo(new BigDecimal("150.00"));
        assertThat(osp.getMaquininhaId()).isNull();
    }

    @Test
    @DisplayName("Cartão sem maquininha ativa fica com MDR pendente (taxa/liquido null) e venda segue")
    void cartaoSemMaquininhaAtivaFicaPendente() {
        quandoFormaResolvida(formaCredito(), FORMA_CREDITO_ID);
        when(maquininhaRepository.findByLojaIdAndAtivoTrue(LOJA_ID)).thenReturn(List.of());

        OrdemServicoResponse res = criarVendaCartao(FORMA_CREDITO_ID, new BigDecimal("300.00"), 1);

        OrdemServicoPagamento osp = capturarPagamento();
        assertThat(osp.getTaxaValor()).isNull();
        assertThat(osp.getValorLiquido()).isNull();
        assertThat(osp.getMaquininhaId()).isNull();
        assertThat(res.getStatus()).isEqualTo("PEDIDO_CONFIRMADO"); // venda não quebrou
    }

    // ------------------------------------------------------------------
    // Comissão automática (§3.6)
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Venda finalizada apura comissão uma vez, com vendaId/vendedor do JWT e itens por categoria")
    void comissaoApuradaUmaVezNaFinalizacao() {
        autenticarVendedor();
        quandoFormaResolvida(formaPix(), FORMA_PIX_ID);
        Produto p = produtoComCategoria(new BigDecimal("1000.00"), "Armações");
        when(produtoRepository.findByIdAndLojaId(PRODUTO_ID, LOJA_ID)).thenReturn(Optional.of(p));

        OrdemServicoRequest req = OrdemServicoRequest.builder()
                .clienteId(CLIENTE_ID)
                .itens(List.of(OrdemServicoRequest.ItemRequest.builder()
                        .produtoId(PRODUTO_ID)
                        .quantidade(1)
                        .build()))
                .pagamentos(List.of(pagamento(FORMA_PIX_ID, new BigDecimal("1000.00"))))
                .build();

        OrdemServicoResponse res = service.criar(req);

        assertThat(res.getStatus()).isEqualTo("PEDIDO_CONFIRMADO");
        ArgumentCaptor<ApurarComissaoRequest> captor = ArgumentCaptor.forClass(ApurarComissaoRequest.class);
        verify(comissaoService, times(1)).apurar(captor.capture());

        ApurarComissaoRequest apur = captor.getValue();
        assertThat(apur.getVendaId()).isEqualTo(res.getId());
        assertThat(apur.getVendaNumero()).startsWith("OS-");
        assertThat(apur.getVendedorId()).isEqualTo(VENDEDOR_ID);
        assertThat(apur.getValorTotal()).isEqualByComparingTo(new BigDecimal("1000.00"));
        assertThat(apur.getItens()).hasSize(1);
        assertThat(apur.getItens().get(0).getCategoria()).isEqualTo("Armações");
        assertThat(apur.getItens().get(0).getSubtotal()).isEqualByComparingTo(new BigDecimal("1000.00"));
    }

    @Test
    @DisplayName("Falha na apuração NUNCA quebra a venda: WARN e venda persistida")
    void falhaNaApuracaoNaoQuebraVenda() {
        autenticarVendedor();
        quandoFormaResolvida(formaPix(), FORMA_PIX_ID);
        Produto p = produtoComCategoria(new BigDecimal("500.00"), "Lentes");
        when(produtoRepository.findByIdAndLojaId(PRODUTO_ID, LOJA_ID)).thenReturn(Optional.of(p));
        doThrow(new RuntimeException("boom na comissão")).when(comissaoService).apurar(any());

        OrdemServicoRequest req = OrdemServicoRequest.builder()
                .clienteId(CLIENTE_ID)
                .itens(List.of(OrdemServicoRequest.ItemRequest.builder()
                        .produtoId(PRODUTO_ID)
                        .quantidade(1)
                        .build()))
                .pagamentos(List.of(pagamento(FORMA_PIX_ID, new BigDecimal("500.00"))))
                .build();

        OrdemServicoResponse res = service.criar(req);

        assertThat(res).isNotNull();
        assertThat(res.getStatus()).isEqualTo("PEDIDO_CONFIRMADO");
        verify(comissaoService, times(1)).apurar(any()); // tentou, falhou, seguiu
        verify(repository, times(2)).save(any(OrdemServico.class)); // OS persistida normalmente
    }

    @Test
    @DisplayName("Orçamento (sem pagamento) não apura comissão")
    void orcamentoNaoApuraComissao() {
        autenticarVendedor();

        OrdemServicoResponse res = service.criar(OrdemServicoRequest.builder()
                .clienteId(CLIENTE_ID)
                .build());

        assertThat(res.getStatus()).isEqualTo("ORCAMENTO");
        verify(comissaoService, never()).apurar(any());
    }

    @Test
    @DisplayName("Venda com valor, mas sem vendedor no contexto, pula apuração (WARN) e não quebra")
    void vendaSemVendedorNoContextoPulaApuracao() {
        // sem SecurityContextHolder: nenhuma autenticação
        quandoFormaResolvida(formaPix(), FORMA_PIX_ID);
        Produto p = produtoComCategoria(new BigDecimal("200.00"), "Lentes");
        when(produtoRepository.findByIdAndLojaId(PRODUTO_ID, LOJA_ID)).thenReturn(Optional.of(p));

        OrdemServicoRequest req = OrdemServicoRequest.builder()
                .clienteId(CLIENTE_ID)
                .itens(List.of(OrdemServicoRequest.ItemRequest.builder()
                        .produtoId(PRODUTO_ID)
                        .quantidade(1)
                        .build()))
                .pagamentos(List.of(pagamento(FORMA_PIX_ID, new BigDecimal("200.00"))))
                .build();

        OrdemServicoResponse res = service.criar(req);

        assertThat(res.getStatus()).isEqualTo("PEDIDO_CONFIRMADO");
        verify(comissaoService, never()).apurar(any());
    }

    // ------------------------------------------------------------------
    // Fixtures
    // ------------------------------------------------------------------

    private OrdemServicoResponse criarVenda(OrdemServicoRequest.PagamentoRequest pg) {
        OrdemServicoRequest req = OrdemServicoRequest.builder()
                .clienteId(CLIENTE_ID)
                .pagamentos(List.of(pg))
                .build();
        return service.criar(req);
    }

    private OrdemServicoResponse criarVendaCartao(UUID formaId, BigDecimal valor, Integer parcelas) {
        OrdemServicoRequest.PagamentoRequest pg = pagamento(formaId, valor);
        pg.setParcelas(parcelas);
        return criarVenda(pg);
    }

    private OrdemServicoRequest.PagamentoRequest pagamento(UUID formaId, BigDecimal valor) {
        return OrdemServicoRequest.PagamentoRequest.builder()
                .formaPagamentoId(formaId)
                .valor(valor)
                .build();
    }

    private OrdemServicoPagamento capturarPagamento() {
        ArgumentCaptor<OrdemServicoPagamento> captor = ArgumentCaptor.forClass(OrdemServicoPagamento.class);
        verify(pagamentoRepository).save(captor.capture());
        return captor.getValue();
    }

    private void quandoFormaResolvida(FormaPagamento forma, UUID formaId) {
        forma.setId(formaId);
        forma.setLojaId(LOJA_ID);
        when(formaPagamentoRepository.findByIdAndLojaId(formaId, LOJA_ID)).thenReturn(Optional.of(forma));
    }

    private void quandoUmaMaquininhaAtiva() {
        when(maquininhaRepository.findByLojaIdAndAtivoTrue(LOJA_ID)).thenReturn(List.of(maquininha));
    }

    private FormaPagamento formaCredito() {
        return FormaPagamento.builder()
                .nome("Crédito")
                .tipo(FormaPagamento.TipoFormaPagamento.CREDITO)
                .ativo(true)
                .padrao(false)
                .permiteParcelar(true)
                .maxParcelas(12)
                .build();
    }

    private FormaPagamento formaDebito() {
        return FormaPagamento.builder()
                .nome("Débito")
                .tipo(FormaPagamento.TipoFormaPagamento.DEBITO)
                .ativo(true)
                .padrao(false)
                .permiteParcelar(false)
                .build();
    }

    private FormaPagamento formaPix() {
        return FormaPagamento.builder()
                .nome("PIX")
                .tipo(FormaPagamento.TipoFormaPagamento.PIX)
                .ativo(true)
                .padrao(false)
                .build();
    }

    private Produto produtoComCategoria(BigDecimal precoVenda, String categoria) {
        Produto p = Produto.builder()
                .nome("Armação Ray-Ban")
                .precoVenda(precoVenda)
                .categoria(categoria)
                .tipoProduto(Produto.TipoProduto.ARMACAO)
                .build();
        p.setId(PRODUTO_ID);
        p.setLojaId(LOJA_ID);
        return p;
    }

    private void autenticarVendedor() {
        Usuario vendedor = Usuario.builder()
                .nome("Vendedora Ótica")
                .perfil(Perfil.VENDEDOR)
                .build();
        vendedor.setId(VENDEDOR_ID);
        SecurityContextHolder.getContext()
                .setAuthentication(new UsernamePasswordAuthenticationToken(vendedor, null));
    }
}
