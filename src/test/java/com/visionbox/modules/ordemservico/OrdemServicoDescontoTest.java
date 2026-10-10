package com.visionbox.modules.ordemservico;

import com.visionbox.modules.catalogo.domain.Produto;
import com.visionbox.modules.catalogo.repository.ProdutoRepository;
import com.visionbox.modules.ordemservico.domain.OrdemServico;
import com.visionbox.modules.ordemservico.domain.StatusOS;
import com.visionbox.modules.ordemservico.domain.TransicaoOSRegistry;
import com.visionbox.modules.ordemservico.dto.OrdemServicoRequest;
import com.visionbox.modules.ordemservico.dto.OrdemServicoResponse;
import com.visionbox.modules.ordemservico.mapper.OrdemServicoMapper;
import com.visionbox.modules.ordemservico.repository.OrdemServicoRepository;
import com.visionbox.modules.ordemservico.service.OrdemServicoService;
import com.visionbox.modules.ordemservico.service.RastreioTokenService;
import com.visionbox.modules.seguranca.desconto.dto.AutorizacaoDescontoRequest;
import com.visionbox.modules.seguranca.desconto.dto.AutorizacaoDescontoResponse;
import com.visionbox.modules.seguranca.desconto.service.AutorizacaoDescontoService;
import com.visionbox.shared.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@DisplayName("OrdemServicoService — Validação Server-Side de Alçada de Desconto (D-010 / P8)")
class OrdemServicoDescontoTest {

    private static final UUID LOJA_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID CLIENTE_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID PRODUTO_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

    private OrdemServicoRepository repository;
    private ProdutoRepository produtoRepository;
    private AutorizacaoDescontoService autorizacaoDescontoService;
    private RastreioTokenService rastreioTokenService;
    private OrdemServicoService service;

    @BeforeEach
    void setUp() {
        TransicaoOSRegistry registry = new TransicaoOSRegistry();
        repository = mock(OrdemServicoRepository.class);
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
        Clock clock = Clock.fixed(Instant.parse("2026-10-10T12:00:00Z"), ZoneOffset.UTC);
        produtoRepository = mock(ProdutoRepository.class);
        autorizacaoDescontoService = mock(AutorizacaoDescontoService.class);
        rastreioTokenService = mock(RastreioTokenService.class);

        service = new OrdemServicoService(
                registry,
                repository,
                mapper,
                clock,
                null,
                null,
                produtoRepository,
                null,
                null,
                null,
                null,
                rastreioTokenService,
                autorizacaoDescontoService
        );

        TenantContext.setCurrentLojaId(LOJA_ID);

        Produto p = Produto.builder()
                .nome("Armação Ray-Ban")
                .precoVenda(new BigDecimal("1000.00"))
                .tipoProduto(Produto.TipoProduto.ARMACAO)
                .build();
        p.setId(PRODUTO_ID);
        p.setLojaId(LOJA_ID);
        when(produtoRepository.findByIdAndLojaId(PRODUTO_ID, LOJA_ID)).thenReturn(Optional.of(p));
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

    @Test
    @DisplayName("Desconto <= 15% é aceito diretamente sem PIN gerencial")
    void descontoAbaixoOuIgualLimiteNaoExigePin() {
        OrdemServicoRequest req = OrdemServicoRequest.builder()
                .clienteId(CLIENTE_ID)
                .armacaoId(PRODUTO_ID)
                .desconto(new BigDecimal("100.00")) // 10%
                .build();

        OrdemServicoResponse res = service.criar(req);

        assertThat(res).isNotNull();
        assertThat(res.getStatus()).isEqualTo(StatusOS.ORCAMENTO.name());
    }

    @Test
    @DisplayName("Desconto > 15% sem autorização válida lança exceção")
    void descontoAcimaLimiteSemAutorizacaoLancaExcecao() {
        OrdemServicoRequest req = OrdemServicoRequest.builder()
                .clienteId(CLIENTE_ID)
                .armacaoId(PRODUTO_ID)
                .desconto(new BigDecimal("200.00")) // 20%
                .senhaAutorizacao("senha_errada")
                .build();

        when(autorizacaoDescontoService.autorizar(any(AutorizacaoDescontoRequest.class), eq(LOJA_ID), any(), any(), any()))
                .thenReturn(AutorizacaoDescontoResponse.negado(new BigDecimal("20"), "Senha inválida"));

        assertThatThrownBy(() -> service.criar(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("exige autorização gerencial");
    }

    @Test
    @DisplayName("Desconto > 15% com autorização válida é aceito com sucesso")
    void descontoAcimaLimiteComAutorizacaoValidaSucesso() {
        OrdemServicoRequest req = OrdemServicoRequest.builder()
                .clienteId(CLIENTE_ID)
                .armacaoId(PRODUTO_ID)
                .desconto(new BigDecimal("200.00")) // 20%
                .senhaAutorizacao("senha_correta")
                .build();

        com.visionbox.modules.usuario.domain.Usuario gerente = com.visionbox.modules.usuario.domain.Usuario.builder()
                .nome("Gerente Geral")
                .perfil(com.visionbox.modules.usuario.domain.Perfil.GERENTE)
                .build();
        gerente.setId(UUID.randomUUID());

        when(autorizacaoDescontoService.autorizar(any(AutorizacaoDescontoRequest.class), eq(LOJA_ID), any(), any(), any()))
                .thenReturn(AutorizacaoDescontoResponse.autorizado(new BigDecimal("20"), gerente));

        OrdemServicoResponse res = service.criar(req);

        assertThat(res).isNotNull();
        assertThat(res.getStatus()).isEqualTo(StatusOS.ORCAMENTO.name());
    }
}
