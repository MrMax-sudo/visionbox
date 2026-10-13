package com.visionbox.modules.financeiro.comissao.service;

import com.visionbox.modules.financeiro.comissao.domain.ComissaoConfig;
import com.visionbox.modules.financeiro.comissao.domain.ComissaoLancamento;
import com.visionbox.modules.financeiro.comissao.dto.ApurarComissaoRequest;
import com.visionbox.modules.financeiro.comissao.dto.ComissaoConfigRequest;
import com.visionbox.modules.financeiro.comissao.dto.ComissaoConfigResponse;
import com.visionbox.modules.financeiro.comissao.dto.ComissaoFechamentoResponse;
import com.visionbox.modules.financeiro.comissao.dto.ComissaoLancamentoResponse;
import com.visionbox.modules.financeiro.comissao.dto.ComissaoVendedorResponse;
import com.visionbox.modules.financeiro.comissao.mapper.ComissaoMapper;
import com.visionbox.modules.financeiro.comissao.repository.ComissaoConfigRepository;
import com.visionbox.modules.financeiro.comissao.repository.ComissaoLancamentoRepository;
import com.visionbox.modules.usuario.domain.Perfil;
import com.visionbox.modules.usuario.domain.Usuario;
import com.visionbox.modules.usuario.repository.UsuarioRepository;
import com.visionbox.shared.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Apuração de comissão (§3.6): regra GERAL, regra por CATEGORIA (sem dupla cobrança),
 * idempotência por venda+vendedor, validação de config e fechamento por período.
 */
class ComissaoServiceTest {

    private static final UUID LOJA = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID VENDEDOR = UUID.randomUUID();
    private static final UUID VENDA = UUID.randomUUID();

    private ComissaoConfigRepository configRepository;
    private ComissaoLancamentoRepository lancamentoRepository;
    private UsuarioRepository usuarioRepository;
    private ComissaoMapper mapper;
    private ComissaoService service;
    private final List<List<ComissaoLancamento>> savedBatches = new java.util.ArrayList<>();

    @BeforeEach
    void setUp() {
        configRepository = mock(ComissaoConfigRepository.class);
        lancamentoRepository = mock(ComissaoLancamentoRepository.class);
        usuarioRepository = mock(UsuarioRepository.class);
        mapper = mock(ComissaoMapper.class);

        service = new ComissaoService(configRepository, lancamentoRepository, usuarioRepository, mapper);
        TenantContext.setCurrentLojaId(LOJA);
        savedBatches.clear();

        when(lancamentoRepository.saveAll(anyList())).thenAnswer(inv -> {
            List<ComissaoLancamento> lote = inv.getArgument(0);
            savedBatches.add(lote);
            return lote;
        });
        when(mapper.toLancamentoResponse(any(ComissaoLancamento.class))).thenAnswer(inv -> {
            ComissaoLancamento l = inv.getArgument(0);
            return ComissaoLancamentoResponse.builder()
                    .id(l.getId() != null ? l.getId() : UUID.randomUUID())
                    .vendaId(l.getVendaId())
                    .vendaNumero(l.getVendaNumero())
                    .vendedorId(l.getVendedorId())
                    .vendedorNome(l.getVendedorNome())
                    .categoria(l.getCategoria())
                    .baseCalculo(l.getBaseCalculo())
                    .percentualAplicado(l.getPercentualAplicado())
                    .valorComissao(l.getValorComissao())
                    .status(l.getStatus() != null ? l.getStatus().name() : null)
                    .dataLancamento(l.getDataLancamento())
                    .build();
        });
        when(usuarioRepository.findByIdAndLojaId(any(), any())).thenReturn(Optional.empty());
        when(configRepository.findByLojaIdAndAtivoTrue(LOJA)).thenReturn(List.of());
        when(lancamentoRepository.findByLojaIdAndVendaIdAndVendedorIdAndAtivoTrue(any(), any(), any()))
                .thenReturn(List.of());
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    private ComissaoConfig geral(BigDecimal pct) {
        ComissaoConfig c = ComissaoConfig.builder()
                .lojaId(LOJA).tipo(ComissaoConfig.TipoComissao.GERAL)
                .percentual(pct).ativo(true).build();
        c.setId(UUID.randomUUID());
        return c;
    }

    private ComissaoConfig categoria(String nome, BigDecimal pct) {
        ComissaoConfig c = ComissaoConfig.builder()
                .lojaId(LOJA).tipo(ComissaoConfig.TipoComissao.CATEGORIA)
                .categoria(nome).percentual(pct).ativo(true).build();
        c.setId(UUID.randomUUID());
        return c;
    }

    private ApurarComissaoRequest apurarReq(BigDecimal valorTotal, List<ApurarComissaoRequest.ItemApuracao> itens) {
        return ApurarComissaoRequest.builder()
                .vendaId(VENDA)
                .vendaNumero("VD-2026-00001")
                .vendedorId(VENDEDOR)
                .vendedorNome("Joao Vendedor")
                .valorTotal(valorTotal)
                .itens(itens)
                .build();
    }

    // ------------------------- apuração -------------------------

    @Test
    void apurar_regraGeral_aplicaPercentualSobreTotalDaVenda() {
        when(configRepository.findByLojaIdAndAtivoTrue(LOJA)).thenReturn(List.of(geral(new BigDecimal("5.00"))));

        List<ComissaoLancamentoResponse> resp = service.apurar(apurarReq(new BigDecimal("1000.00"), null));

        assertThat(resp).hasSize(1);
        ComissaoLancamentoResponse l = resp.get(0);
        assertThat(l.getBaseCalculo()).isEqualByComparingTo("1000.00");
        assertThat(l.getPercentualAplicado()).isEqualByComparingTo("5.00");
        assertThat(l.getValorComissao()).isEqualByComparingTo("50.00");
        assertThat(l.getCategoria()).isNull();
        assertThat(l.getVendedorId()).isEqualTo(VENDEDOR);
        assertThat(l.getVendaId()).isEqualTo(VENDA);

        assertThat(savedBatches).hasSize(1);
        assertThat(savedBatches.get(0)).hasSize(1);
        assertThat(savedBatches.get(0).get(0).getLojaId()).isEqualTo(LOJA);
    }

    @Test
    void apurar_categoriaPrevaleceSemDuplaCobranca() {
        when(configRepository.findByLojaIdAndAtivoTrue(LOJA)).thenReturn(List.of(
                geral(new BigDecimal("5.00")),
                categoria("Lentes", new BigDecimal("10.00"))));
        List<ApurarComissaoRequest.ItemApuracao> itens = List.of(
                new ApurarComissaoRequest.ItemApuracao("LENTES", new BigDecimal("400.00")),
                new ApurarComissaoRequest.ItemApuracao("Armacoes", new BigDecimal("600.00")));

        List<ComissaoLancamentoResponse> resp = service.apurar(apurarReq(new BigDecimal("1000.00"), itens));

        assertThat(resp).hasSize(2);
        ComissaoLancamentoResponse porCategoria = resp.stream()
                .filter(l -> l.getCategoria() != null).findFirst().orElseThrow();
        ComissaoLancamentoResponse geralResp = resp.stream()
                .filter(l -> l.getCategoria() == null).findFirst().orElseThrow();

        // categoria: case-insensitive sobre o item da categoria
        assertThat(porCategoria.getCategoria()).isEqualTo("Lentes");
        assertThat(porCategoria.getBaseCalculo()).isEqualByComparingTo("400.00");
        assertThat(porCategoria.getValorComissao()).isEqualByComparingTo("40.00");

        // geral: base = total - bases de categoria (sem dupla cobrança)
        assertThat(geralResp.getBaseCalculo()).isEqualByComparingTo("600.00");
        assertThat(geralResp.getValorComissao()).isEqualByComparingTo("30.00");

        BigDecimal somaBases = porCategoria.getBaseCalculo().add(geralResp.getBaseCalculo());
        assertThat(somaBases).isEqualByComparingTo("1000.00");
    }

    @Test
    void apurar_idempotente_naoDuplicaLancamentoDaVenda() {
        ComissaoLancamento existente = ComissaoLancamento.builder()
                .lojaId(LOJA).vendaId(VENDA).vendedorId(VENDEDOR)
                .baseCalculo(new BigDecimal("1000.00"))
                .percentualAplicado(new BigDecimal("5.00"))
                .valorComissao(new BigDecimal("50.00"))
                .build();
        existente.setId(UUID.randomUUID());
        when(lancamentoRepository.findByLojaIdAndVendaIdAndVendedorIdAndAtivoTrue(LOJA, VENDA, VENDEDOR))
                .thenReturn(List.of(existente));

        List<ComissaoLancamentoResponse> resp = service.apurar(apurarReq(new BigDecimal("1000.00"), null));

        assertThat(resp).hasSize(1);
        assertThat(resp.get(0).getValorComissao()).isEqualByComparingTo("50.00");
        verify(lancamentoRepository, never()).saveAll(anyList());
    }

    @Test
    void apurar_semRegraAtiva_retornaVazioSemSalvar() {
        List<ComissaoLancamentoResponse> resp = service.apurar(apurarReq(new BigDecimal("100.00"), null));

        assertThat(resp).isEmpty();
        verify(lancamentoRepository, never()).saveAll(anyList());
    }

    @Test
    void apurar_itensSomamMaisQueTotal_lancaIllegalArgument() {
        when(configRepository.findByLojaIdAndAtivoTrue(LOJA)).thenReturn(
                List.of(categoria("Lentes", new BigDecimal("10.00"))));
        List<ApurarComissaoRequest.ItemApuracao> itens = List.of(
                new ApurarComissaoRequest.ItemApuracao("Lentes", new BigDecimal("1200.00")));

        assertThatThrownBy(() -> service.apurar(apurarReq(new BigDecimal("1000.00"), itens)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("excede valorTotal");
        verify(lancamentoRepository, never()).saveAll(anyList());
    }

    @Test
    void apurar_semItens_regraCategoriaIgnoradaERestaGeral() {
        when(configRepository.findByLojaIdAndAtivoTrue(LOJA)).thenReturn(List.of(
                geral(new BigDecimal("5.00")),
                categoria("Lentes", new BigDecimal("10.00"))));

        List<ComissaoLancamentoResponse> resp = service.apurar(apurarReq(new BigDecimal("1000.00"), null));

        assertThat(resp).hasSize(1);
        assertThat(resp.get(0).getCategoria()).isNull();
        assertThat(resp.get(0).getBaseCalculo()).isEqualByComparingTo("1000.00");
    }

    // ------------------------- configuração -------------------------

    @Test
    void criarConfig_segundaGeralAtiva_lancaIllegalArgument() {
        when(configRepository.findByLojaIdAndAtivoTrue(LOJA)).thenReturn(List.of(geral(new BigDecimal("5"))));

        ComissaoConfigRequest req = ComissaoConfigRequest.builder()
                .tipo(ComissaoConfig.TipoComissao.GERAL)
                .percentual(new BigDecimal("3.00"))
                .build();

        assertThatThrownBy(() -> service.criarConfig(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("GERAL");
        verify(configRepository, never()).save(any(ComissaoConfig.class));
    }

    @Test
    void criarConfig_categoriaSemNome_lancaIllegalArgument() {
        ComissaoConfigRequest req = ComissaoConfigRequest.builder()
                .tipo(ComissaoConfig.TipoComissao.CATEGORIA)
                .percentual(new BigDecimal("10.00"))
                .build();

        assertThatThrownBy(() -> service.criarConfig(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("categoria");
        verify(configRepository, never()).save(any(ComissaoConfig.class));
    }

    @Test
    void criarConfig_valida_salvaNormalizado() {
        when(configRepository.findByLojaIdAndAtivoTrue(LOJA)).thenReturn(List.of());
        when(configRepository.save(any(ComissaoConfig.class))).thenAnswer(inv -> {
            ComissaoConfig c = inv.getArgument(0);
            c.setId(UUID.randomUUID());
            return c;
        });
        when(mapper.toResponse(any(ComissaoConfig.class))).thenAnswer(inv -> {
            ComissaoConfig c = inv.getArgument(0);
            return ComissaoConfigResponse.builder()
                    .id(c.getId()).tipo(c.getTipo()).categoria(c.getCategoria())
                    .percentual(c.getPercentual()).ativo(c.isAtivo()).build();
        });

        ComissaoConfigRequest req = ComissaoConfigRequest.builder()
                .tipo(ComissaoConfig.TipoComissao.CATEGORIA)
                .categoria("  Lentes  ")
                .percentual(new BigDecimal("10"))
                .build();

        ComissaoConfigResponse resp = service.criarConfig(req);

        assertThat(resp.getCategoria()).isEqualTo("Lentes");
        assertThat(resp.getPercentual()).isEqualByComparingTo("10.00");
        assertThat(resp.isAtivo()).isTrue();
    }

    // ------------------------- fechamento -------------------------

    @Test
    void fechamento_agrupaPorVendedorEExcluiCancelados() {
        UUID outro = UUID.randomUUID();
        OffsetDateTime agora = OffsetDateTime.now();

        ComissaoLancamento l1 = ComissaoLancamento.builder()
                .lojaId(LOJA).vendedorId(VENDEDOR).vendedorNome("Joao")
                .baseCalculo(new BigDecimal("1000.00")).percentualAplicado(new BigDecimal("5.00"))
                .valorComissao(new BigDecimal("50.00"))
                .dataLancamento(agora).build();
        l1.setId(UUID.randomUUID());
        ComissaoLancamento l2 = ComissaoLancamento.builder()
                .lojaId(LOJA).vendedorId(VENDEDOR).vendedorNome("Joao")
                .baseCalculo(new BigDecimal("200.00")).percentualAplicado(new BigDecimal("5.00"))
                .valorComissao(new BigDecimal("10.00"))
                .dataLancamento(agora).build();
        l2.setId(UUID.randomUUID());
        ComissaoLancamento cancelado = ComissaoLancamento.builder()
                .lojaId(LOJA).vendedorId(outro).vendedorNome("Maria")
                .baseCalculo(new BigDecimal("9999.00")).percentualAplicado(new BigDecimal("5.00"))
                .valorComissao(new BigDecimal("499.95"))
                .status(ComissaoLancamento.StatusComissao.CANCELADO)
                .dataLancamento(agora).build();
        cancelado.setId(UUID.randomUUID());

        when(lancamentoRepository
                .findByLojaIdAndDataLancamentoGreaterThanEqualAndDataLancamentoLessThan(
                        eq(LOJA), any(OffsetDateTime.class), any(OffsetDateTime.class)))
                .thenReturn(List.of(l1, l2, cancelado));

        ComissaoFechamentoResponse resp = service.fechamento(
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), null);

        assertThat(resp.getDataInicio()).isEqualTo("2026-10-01");
        assertThat(resp.getDataFim()).isEqualTo("2026-10-31");
        assertThat(resp.getQuantidadeLancamentos()).isEqualTo(2);
        assertThat(resp.getTotalComissao()).isEqualByComparingTo("60.00");
        assertThat(resp.getTotalBase()).isEqualByComparingTo("1200.00");
        assertThat(resp.getPorVendedor()).hasSize(1);
        ComissaoFechamentoResponse.ComissaoVendedorFechamento agg = resp.getPorVendedor().get(0);
        assertThat(agg.getVendedorId()).isEqualTo(VENDEDOR);
        assertThat(agg.getVendedorNome()).isEqualTo("Joao");
        assertThat(agg.getQuantidadeLancamentos()).isEqualTo(2);
        assertThat(agg.getValorComissao()).isEqualByComparingTo("60.00");

        // linhas do período: mesmo filtro do agregado (cancelado fora) e totais consistentes
        assertThat(resp.getLancamentos()).hasSize(2);
        assertThat(resp.getLancamentos())
                .allSatisfy(l -> {
                    assertThat(l.getVendedorId()).isEqualTo(VENDEDOR);
                    assertThat(l.getVendedorNome()).isEqualTo("Joao");
                    assertThat(l.getStatus()).isEqualTo("PENDENTE");
                });
        BigDecimal somaBases = resp.getLancamentos().stream()
                .map(ComissaoLancamentoResponse::getBaseCalculo)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal somaValores = resp.getLancamentos().stream()
                .map(ComissaoLancamentoResponse::getValorComissao)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(somaBases).isEqualByComparingTo(resp.getTotalBase());
        assertThat(somaValores).isEqualByComparingTo(resp.getTotalComissao());
        assertThat(resp.getLancamentos()).hasSize(resp.getQuantidadeLancamentos());
    }

    @Test
    void fechamento_lancamentosPorVenda_ordenadosPorDataETotaisBatem() {
        UUID outroVendedor = UUID.randomUUID();
        OffsetDateTime d1 = OffsetDateTime.parse("2026-10-02T10:00:00-03:00");
        OffsetDateTime d2 = OffsetDateTime.parse("2026-10-05T09:30:00-03:00");
        OffsetDateTime d3 = OffsetDateTime.parse("2026-10-05T11:00:00-03:00");

        ComissaoLancamento porCategoria = ComissaoLancamento.builder()
                .lojaId(LOJA).vendaId(VENDA).vendaNumero("VD-1").vendedorId(VENDEDOR)
                .vendedorNome("Joao").categoria("Lentes")
                .baseCalculo(new BigDecimal("400.00")).percentualAplicado(new BigDecimal("10.00"))
                .valorComissao(new BigDecimal("40.00")).dataLancamento(d3).build();
        porCategoria.setId(UUID.randomUUID());
        ComissaoLancamento geralDepois = ComissaoLancamento.builder()
                .lojaId(LOJA).vendaId(UUID.randomUUID()).vendaNumero("VD-3").vendedorId(VENDEDOR)
                .vendedorNome("Joao")
                .baseCalculo(new BigDecimal("600.00")).percentualAplicado(new BigDecimal("5.00"))
                .valorComissao(new BigDecimal("30.00")).dataLancamento(d2).build();
        geralDepois.setId(UUID.randomUUID());
        ComissaoLancamento outroAntes = ComissaoLancamento.builder()
                .lojaId(LOJA).vendaId(UUID.randomUUID()).vendaNumero("VD-2")
                .vendedorId(outroVendedor).vendedorNome("Maria")
                .baseCalculo(new BigDecimal("200.00")).percentualAplicado(new BigDecimal("5.00"))
                .valorComissao(new BigDecimal("10.00")).dataLancamento(d1).build();
        outroAntes.setId(UUID.randomUUID());

        // devolve fora de ordem para provar o sort do service
        when(lancamentoRepository
                .findByLojaIdAndDataLancamentoGreaterThanEqualAndDataLancamentoLessThan(
                        eq(LOJA), any(OffsetDateTime.class), any(OffsetDateTime.class)))
                .thenReturn(List.of(porCategoria, geralDepois, outroAntes));

        ComissaoFechamentoResponse resp = service.fechamento(
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), null);

        List<ComissaoLancamentoResponse> linhas = resp.getLancamentos();
        assertThat(linhas).hasSize(3);
        assertThat(linhas).extracting(ComissaoLancamentoResponse::getDataLancamento)
                .containsExactly(d1, d2, d3);
        assertThat(linhas.get(0).getVendaNumero()).isEqualTo("VD-2");
        assertThat(linhas.get(1).getVendaNumero()).isEqualTo("VD-3");
        assertThat(linhas.get(2).getVendaNumero()).isEqualTo("VD-1");
        assertThat(linhas.get(2).getCategoria()).isEqualTo("Lentes");
        assertThat(linhas.get(2).getPercentualAplicado()).isEqualByComparingTo("10.00");
        assertThat(linhas.get(2).getVendaId()).isEqualTo(VENDA);

        // consistência: agregado deriva das mesmas linhas
        assertThat(linhas).hasSize(resp.getQuantidadeLancamentos());
        BigDecimal somaBases = linhas.stream()
                .map(ComissaoLancamentoResponse::getBaseCalculo)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal somaValores = linhas.stream()
                .map(ComissaoLancamentoResponse::getValorComissao)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(somaBases).isEqualByComparingTo(resp.getTotalBase());
        assertThat(somaValores).isEqualByComparingTo(resp.getTotalComissao());
        assertThat(resp.getPorVendedor()).hasSize(2);
    }

    @Test
    void fechamento_periodoInvalido_lancaIllegalArgument() {
        assertThatThrownBy(() -> service.fechamento(
                LocalDate.of(2026, 11, 1), LocalDate.of(2026, 10, 1), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("dataInicio");
        assertThatThrownBy(() -> service.fechamento(null, LocalDate.of(2026, 10, 1), null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void fechamento_comVendedor_executaQueryEscopada() {
        when(lancamentoRepository
                .findByLojaIdAndVendedorIdAndDataLancamentoGreaterThanEqualAndDataLancamentoLessThan(
                        eq(LOJA), eq(VENDEDOR), any(OffsetDateTime.class), any(OffsetDateTime.class)))
                .thenReturn(List.of());

        ComissaoFechamentoResponse resp = service.fechamento(
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), VENDEDOR);

        assertThat(resp.getQuantidadeLancamentos()).isZero();
        assertThat(resp.getTotalComissao()).isEqualByComparingTo("0.00");
        assertThat(resp.getPorVendedor()).isEmpty();
        assertThat(resp.getLancamentos()).isNotNull().isEmpty();
    }

    // ------------------------- vendedores -------------------------

    @Test
    void listarVendedores_retornaSomentePerfisDeVendaAtivosDaLoja() {
        Usuario vendedor = Usuario.builder()
                .lojaId(LOJA).nome("Ze Vendedor").email("ze@optica.local")
                .perfil(Perfil.VENDEDOR).build();
        vendedor.setId(UUID.randomUUID());
        Usuario otico = Usuario.builder()
                .lojaId(LOJA).nome("Ana Otica").email("ana@optica.local")
                .perfil(Perfil.OTICO).build();
        otico.setId(UUID.randomUUID());
        // devolve fora de ordem alfabética para provar o sort do service
        when(usuarioRepository.findByLojaIdAndPerfilInAndAtivoTrue(eq(LOJA), any()))
                .thenReturn(List.of(vendedor, otico));

        List<ComissaoVendedorResponse> resp = service.listarVendedores();

        // perfis consultados: exatamente VENDEDOR + OTICO (GERENTE/ADMIN/FINANCEIRO fora)
        ArgumentCaptor<Collection<Perfil>> perfisCaptor = ArgumentCaptor.forClass(Collection.class);
        verify(usuarioRepository).findByLojaIdAndPerfilInAndAtivoTrue(eq(LOJA), perfisCaptor.capture());
        assertThat(perfisCaptor.getValue()).containsExactlyInAnyOrder(Perfil.VENDEDOR, Perfil.OTICO);

        // resposta: id+nome, ordenada por nome — sem email ou outra PII (R7)
        assertThat(resp).hasSize(2);
        assertThat(resp).extracting(ComissaoVendedorResponse::getNome)
                .containsExactly("Ana Otica", "Ze Vendedor");
        assertThat(resp).extracting(ComissaoVendedorResponse::getId)
                .containsExactlyInAnyOrder(otico.getId(), vendedor.getId());
        assertThat(resp.get(0)).hasNoNullFieldsOrProperties();
    }
}
