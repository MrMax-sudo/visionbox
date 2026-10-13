package com.visionbox.modules.compras.service;

import com.visionbox.modules.compras.domain.Compra;
import com.visionbox.modules.compras.domain.CompraItem;
import com.visionbox.modules.compras.dto.CompraResponse;
import com.visionbox.modules.compras.repository.CompraRepository;
import com.visionbox.modules.catalogo.domain.Produto;
import com.visionbox.modules.catalogo.repository.ProdutoRepository;
import com.visionbox.modules.estoque.service.EstoqueService;
import com.visionbox.modules.financeiro.domain.ContaPagar;
import com.visionbox.modules.financeiro.repository.ContaPagarRepository;
import com.visionbox.shared.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Importação de XML NF-e (§3.4): de-para EAN/SKU, pré-cadastro, entrada em estoque,
 * geração de ContaPagar pelas duplicatas (e título único sem duplicatas) e idempotência por chave.
 * Mockito puro — parser real com a fixture de resources/fixtures/nfe-exemplo.xml.
 */
class CompraImportacaoServiceTest {

    private static final UUID LOJA = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID USUARIO = UUID.randomUUID();
    private static final String CHAVE = "35261012345678000195550010000001231123456785";

    private CompraRepository compraRepository;
    private ProdutoRepository produtoRepository;
    private EstoqueService estoqueService;
    private ContaPagarRepository contaPagarRepository;
    private CompraImportacaoService service;

    private Produto produtoLente;
    private Produto produtoArmacao;

    @BeforeEach
    void setUp() {
        compraRepository = mock(CompraRepository.class);
        produtoRepository = mock(ProdutoRepository.class);
        estoqueService = mock(EstoqueService.class);
        contaPagarRepository = mock(ContaPagarRepository.class);
        service = new CompraImportacaoService(compraRepository, produtoRepository,
                estoqueService, contaPagarRepository, new NfeXmlParser());
        TenantContext.setCurrentLojaId(LOJA);

        produtoLente = Produto.builder()
                .lojaId(LOJA).sku("LEN-9001").codigoBarras("7891234567895")
                .nome("Lente existente").custo(new BigDecimal("50.00"))
                .precoVenda(new BigDecimal("90.00")).build();
        produtoLente.setId(UUID.randomUUID());

        produtoArmacao = Produto.builder()
                .lojaId(LOJA).sku("ARM-7788")
                .nome("Armacao existente").custo(new BigDecimal("100.00"))
                .precoVenda(new BigDecimal("250.00")).build();
        produtoArmacao.setId(UUID.randomUUID());

        when(compraRepository.existsByLojaIdAndChaveAcessoAndAtivoTrue(any(), any())).thenReturn(false);
        when(compraRepository.save(any(Compra.class))).thenAnswer(inv -> {
            Compra c = inv.getArgument(0);
            if (c.getId() == null) c.setId(UUID.randomUUID());
            return c;
        });
        when(contaPagarRepository.save(any(ContaPagar.class))).thenAnswer(inv -> {
            ContaPagar c = inv.getArgument(0);
            if (c.getId() == null) c.setId(UUID.randomUUID());
            return c;
        });
        when(produtoRepository.save(any(Produto.class))).thenAnswer(inv -> {
            Produto p = inv.getArgument(0);
            if (p.getId() == null) p.setId(UUID.randomUUID());
            return p;
        });
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    static String fixture() throws IOException {
        try (InputStream in = CompraImportacaoServiceTest.class.getResourceAsStream("/fixtures/nfe-exemplo.xml")) {
            assertThat(in).isNotNull();
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    @Test
    void importar_xmlCompleto_deParaPorEanESku_estoqueEContasPagar() throws IOException {
        // item 1 casa por EAN; item 2 (SEM GTIN) casa por SKU do fornecedor
        when(produtoRepository.findByCodigoBarrasAndLojaId("7891234567895", LOJA))
                .thenReturn(Optional.of(produtoLente));
        when(produtoRepository.findByCodigoBarrasAndLojaId("ARM-7788", LOJA))
                .thenReturn(Optional.empty());
        when(produtoRepository.findBySkuAndLojaId("ARM-7788", LOJA))
                .thenReturn(Optional.of(produtoArmacao));

        CompraResponse resp = service.importarXml(fixture(), USUARIO);

        // cabeçalho
        assertThat(resp.getId()).isNotNull();
        assertThat(resp.getChaveAcesso()).isEqualTo(CHAVE);
        assertThat(resp.getNumero()).isEqualTo("0000123");
        assertThat(resp.getFornecedorNome()).isEqualTo("LABORATORIO EXEMPLO LTDA");
        assertThat(resp.getFornecedorCnpj()).isEqualTo("12345678000195");
        assertThat(resp.getValorTotal()).isEqualByComparingTo("1061.50");
        assertThat(resp.getStatus()).isEqualTo("IMPORTADA");
        assertThat(resp.getItens()).hasSize(2);
        assertThat(resp.getContasPagarIds()).hasSize(2).doesNotContainNull();

        ArgumentCaptor<Compra> compraCaptor = ArgumentCaptor.forClass(Compra.class);
        verify(compraRepository).save(compraCaptor.capture());
        Compra compra = compraCaptor.getValue();
        assertThat(compra.getLojaId()).isEqualTo(LOJA);
        assertThat(compra.getUsuarioId()).isEqualTo(USUARIO);
        assertThat(compra.getXmlFiscal()).contains("nfeProc");
        assertThat(compra.getItens()).hasSize(2);
        assertThat(compra.getItens().get(0).getProdutoId()).isEqualTo(produtoLente.getId());
        assertThat(compra.getItens().get(1).getProdutoId()).isEqualTo(produtoArmacao.getId());
        assertThat(compra.getItens().get(0).getEan()).isEqualTo("7891234567895");
        assertThat(compra.getItens().get(1).getEan()).isNull();

        // entrada em estoque: 10 lentes e 5 armações
        verify(estoqueService).adicionar(produtoLente.getId(), 10);
        verify(estoqueService).adicionar(produtoArmacao.getId(), 5);
        verify(estoqueService, never()).adicionar(any(), eq(0));

        // custo do produto atualizado com o preço da nota
        assertThat(produtoLente.getCusto()).isEqualByComparingTo("45.90");
        assertThat(produtoArmacao.getCusto()).isEqualByComparingTo("120.50");
        // NCM preenchido no catálogo quando vazio
        assertThat(produtoArmacao.getNcm()).isEqualTo("90041000");

        // itens casados no catálogo: preCadastrado=false (nenhum pré-cadastro nesta nota)
        assertThat(resp.getItens().get(0).getPreCadastrado()).isFalse();
        assertThat(resp.getItens().get(1).getPreCadastrado()).isFalse();
        assertThat(compra.getItens().get(0).isPreCadastrado()).isFalse();
        assertThat(compra.getItens().get(1).isPreCadastrado()).isFalse();

        // ContaPagar: uma por duplicata
        ArgumentCaptor<ContaPagar> contasCaptor = ArgumentCaptor.forClass(ContaPagar.class);
        verify(contaPagarRepository, org.mockito.Mockito.times(2)).save(contasCaptor.capture());
        List<ContaPagar> contas = contasCaptor.getAllValues();
        ContaPagar primeira = contas.stream().filter(c -> c.getParcela() == 1).findFirst().orElseThrow();
        ContaPagar segunda = contas.stream().filter(c -> c.getParcela() == 2).findFirst().orElseThrow();

        assertThat(primeira.getValor()).isEqualByComparingTo("530.75");
        assertThat(primeira.getVencimento()).isEqualTo(LocalDate.of(2026, 11, 5));
        assertThat(primeira.getNumeroDocumento()).isEqualTo("001");
        assertThat(segunda.getValor()).isEqualByComparingTo("530.75");
        assertThat(segunda.getVencimento()).isEqualTo(LocalDate.of(2026, 12, 5));
        assertThat(segunda.getNumeroDocumento()).isEqualTo("002");
        for (ContaPagar c : contas) {
            assertThat(c.getLojaId()).isEqualTo(LOJA);
            assertThat(c.getFornecedor()).isEqualTo("LABORATORIO EXEMPLO LTDA");
            assertThat(c.getStatus()).isEqualTo(ContaPagar.StatusContaPagar.PENDENTE);
            assertThat(c.getTotalParcelas()).isEqualTo(2);
            assertThat(c.getDataCompetencia()).isEqualTo(LocalDate.of(2026, 10, 5));
        }
    }

    @Test
    void importar_semDuplicatas_noXml_geraTituloUnicoNaDataEmissao() throws IOException {
        String semCobr = fixture().replaceAll("(?s)<cobr>.*?</cobr>", "");
        when(produtoRepository.findByCodigoBarrasAndLojaId(any(), any())).thenReturn(Optional.empty());
        when(produtoRepository.findBySkuAndLojaId(any(), any())).thenReturn(Optional.empty());

        service.importarXml(semCobr, USUARIO);

        ArgumentCaptor<ContaPagar> captor = ArgumentCaptor.forClass(ContaPagar.class);
        verify(contaPagarRepository).save(captor.capture());
        ContaPagar conta = captor.getValue();
        assertThat(conta.getVencimento()).isEqualTo(LocalDate.of(2026, 10, 5));
        assertThat(conta.getValor()).isEqualByComparingTo("1061.50");
        assertThat(conta.getParcela()).isNull();
        assertThat(conta.getTotalParcelas()).isNull();
        assertThat(conta.getNumeroDocumento()).isEqualTo("0000123");
        assertThat(conta.getDataCompetencia()).isEqualTo(LocalDate.of(2026, 10, 5));
    }

    @Test
    void importar_eanNaoCasa_caiParaSkuDoFornecedor() throws IOException {
        when(produtoRepository.findByCodigoBarrasAndLojaId(any(), any())).thenReturn(Optional.empty());
        when(produtoRepository.findBySkuAndLojaId("LEN-9001", LOJA)).thenReturn(Optional.of(produtoLente));
        when(produtoRepository.findBySkuAndLojaId("ARM-7788", LOJA)).thenReturn(Optional.of(produtoArmacao));

        CompraResponse resp = service.importarXml(fixture(), USUARIO);

        verify(produtoRepository).findByCodigoBarrasAndLojaId("7891234567895", LOJA);
        verify(produtoRepository).findBySkuAndLojaId("LEN-9001", LOJA);
        verify(produtoRepository).findBySkuAndLojaId("ARM-7788", LOJA);
        assertThat(resp.getItens()).hasSize(2);
    }

    @Test
    void importar_semMatch_fazPreCadastroAutomatico() throws IOException {
        when(produtoRepository.findByCodigoBarrasAndLojaId(any(), any())).thenReturn(Optional.empty());
        when(produtoRepository.findBySkuAndLojaId(any(), any())).thenReturn(Optional.empty());

        CompraResponse resp = service.importarXml(fixture(), USUARIO);

        ArgumentCaptor<Produto> captor = ArgumentCaptor.forClass(Produto.class);
        verify(produtoRepository, org.mockito.Mockito.times(2)).save(captor.capture());
        List<Produto> novos = captor.getAllValues();

        Produto lente = novos.get(0);
        assertThat(lente.getSku()).isEqualTo("LEN-9001");
        assertThat(lente.getNome()).isEqualTo("LENS OFTALMICA 1.60 ANTIRREFLEXO");
        assertThat(lente.getCodigoBarras()).isEqualTo("7891234567895");
        assertThat(lente.getNcm()).isEqualTo("90011010");
        assertThat(lente.getCusto()).isEqualByComparingTo("45.90");
        assertThat(lente.getPrecoVenda()).isEqualByComparingTo("0");
        assertThat(lente.getLojaId()).isEqualTo(LOJA);

        Produto armacao = novos.get(1);
        assertThat(armacao.getSku()).isEqualTo("ARM-7788");
        assertThat(armacao.getCodigoBarras()).as("SEM GTIN não vira código de barras").isNull();

        // sem match no catálogo: TODOS os itens respondem preCadastrado=true
        assertThat(resp.getItens()).hasSize(2);
        assertThat(resp.getItens()).allSatisfy(i -> assertThat(i.getPreCadastrado()).isTrue());

        // pré-cadastros entram no estoque da nota
        verify(estoqueService).adicionar(lente.getId(), 10);
        verify(estoqueService).adicionar(armacao.getId(), 5);
        assertThat(resp.getContasPagarIds()).hasSize(2);
    }

    @Test
    void importar_notaMista_umItemDoCatalogoOutroPreCadastrado() throws IOException {
        // item 1 (EAN) casa no catálogo; item 2 (SEM GTIN, SKU inédito) vira pré-cadastro
        when(produtoRepository.findByCodigoBarrasAndLojaId("7891234567895", LOJA))
                .thenReturn(Optional.of(produtoLente));
        when(produtoRepository.findByCodigoBarrasAndLojaId("ARM-7788", LOJA))
                .thenReturn(Optional.empty());
        when(produtoRepository.findBySkuAndLojaId(any(), any())).thenReturn(Optional.empty());

        CompraResponse resp = service.importarXml(fixture(), USUARIO);

        assertThat(resp.getItens()).hasSize(2);
        assertThat(resp.getItens().get(0).getPreCadastrado())
                .as("item casado por EAN no catálogo").isFalse();
        assertThat(resp.getItens().get(1).getPreCadastrado())
                .as("item sem match foi pré-cadastrado").isTrue();
        assertThat(resp.getItens().get(1).getProdutoId()).isNotNull();
    }

    @Test
    void buscar_leituraPersistida_expoePreCadastradoNulo() {
        Compra compra = Compra.builder()
                .lojaId(LOJA).numero("0000123").status(Compra.StatusCompra.IMPORTADA)
                .valorTotal(new BigDecimal("100.00")).dataEmissao(LocalDate.of(2026, 10, 5))
                .fornecedorNome("FORNECEDOR").build();
        compra.setId(UUID.randomUUID());
        compra.addItem(CompraItem.builder()
                .lojaId(LOJA).produtoId(UUID.randomUUID()).descricao("Item")
                .quantidade(BigDecimal.ONE).custoUnitario(new BigDecimal("100.00"))
                .valorTotal(new BigDecimal("100.00")).build());
        when(compraRepository.findByIdComItens(compra.getId(), LOJA)).thenReturn(Optional.of(compra));

        CompraResponse resp = service.buscar(compra.getId());

        assertThat(resp.getItens()).hasSize(1);
        assertThat(resp.getItens().get(0).getPreCadastrado())
                .as("origem só é conhecida na importação — leitura persistida vem null")
                .isNull();
    }

    @Test
    void importar_skuDoFornecedorJaExistenteFallbackParaSkuXml() throws IOException {
        when(produtoRepository.findByCodigoBarrasAndLojaId(any(), any())).thenReturn(Optional.empty());
        when(produtoRepository.findBySkuAndLojaId(any(), any())).thenReturn(Optional.empty());
        when(produtoRepository.existsBySkuAndLojaId("LEN-9001", LOJA)).thenReturn(true);
        when(produtoRepository.existsBySkuAndLojaId("7891234567895", LOJA)).thenReturn(true);
        when(produtoRepository.existsBySkuAndLojaId("XML-LEN-9001", LOJA)).thenReturn(true);

        service.importarXml(fixture(), USUARIO);

        ArgumentCaptor<Produto> captor = ArgumentCaptor.forClass(Produto.class);
        verify(produtoRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
        List<Produto> novos = captor.getAllValues();
        // SKU do fornecedor ocupado → fallback XML-LEN-9001-1 para o primeiro item
        assertThat(novos.get(0).getSku()).isEqualTo("XML-LEN-9001-1");
    }

    @Test
    void importar_chaveJaImportada_lancaIllegalStateSemSalvar() throws IOException {
        when(compraRepository.existsByLojaIdAndChaveAcessoAndAtivoTrue(LOJA, CHAVE)).thenReturn(true);

        assertThatThrownBy(() -> service.importarXml(fixture(), USUARIO))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("já importada")
                .hasMessageContaining(CHAVE);

        verify(compraRepository, never()).save(any(Compra.class));
        verify(estoqueService, never()).adicionar(any(), anyInt());
        verify(contaPagarRepository, never()).save(any(ContaPagar.class));
    }

    @Test
    void importar_semTenant_lancaIllegalState() throws IOException {
        TenantContext.clear();
        assertThatThrownBy(() -> service.importarXml("<x/>", USUARIO))
                .isInstanceOf(IllegalStateException.class);
    }
}
