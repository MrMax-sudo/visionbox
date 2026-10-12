package com.visionbox.modules.catalogo.service;

import com.visionbox.modules.catalogo.domain.Produto;
import com.visionbox.modules.catalogo.dto.ProdutoRequest;
import com.visionbox.modules.catalogo.dto.ProdutoResponse;
import com.visionbox.modules.catalogo.dto.SugestaoSkuEanResponse;
import com.visionbox.modules.catalogo.mapper.ProdutoMapper;
import com.visionbox.modules.catalogo.repository.ProdutoRepository;
import com.visionbox.shared.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProdutoSkuEanTest {

    @Mock
    private ProdutoRepository repository;

    @Mock
    private ProdutoMapper mapper;

    @InjectMocks
    private ProdutoService service;

    private static final UUID LOJA_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @BeforeEach
    void setup() {
        TenantContext.setCurrentLojaId(LOJA_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void calcularEan13_geraDigitoVerificadorGs1Modulo10Correto() {
        // Exemplo 1: sequência 1 -> base 789000000001
        // Posições ímpares (0,2,4,6,8,10): 7+9+0+0+0+0 = 16
        // Posições pares (1,3,5,7,9,11): (8+0+0+0+0+1)*3 = 27
        // Soma = 43 -> resto 3 -> dv = (10 - 3) = 7
        String ean = ProdutoService.calcularEan13(1L);
        assertThat(ean).isEqualTo("7890000000017");
        assertThat(ean).hasSize(13);
    }

    @Test
    void gerarProximoSku_quandoNenhumCadastrado_comecaEmPRD000001() {
        when(repository.findUltimosSkusPorLoja(LOJA_ID)).thenReturn(List.of());
        when(repository.existsBySkuAndLojaId("PRD-000001", LOJA_ID)).thenReturn(false);

        String sku = service.gerarProximoSku(LOJA_ID);
        assertThat(sku).isEqualTo("PRD-000001");
    }

    @Test
    void gerarProximoSku_quandoExistemSkus_incrementaSequencial() {
        when(repository.findUltimosSkusPorLoja(LOJA_ID))
                .thenReturn(List.of("PRD-000042", "PRD-000010"));
        when(repository.existsBySkuAndLojaId("PRD-000043", LOJA_ID)).thenReturn(false);

        String sku = service.gerarProximoSku(LOJA_ID);
        assertThat(sku).isEqualTo("PRD-000043");
    }

    @Test
    void gerarProximoCodigoBarrasEan_quandoExistemCodigos_incrementaSequencialEan13() {
        when(repository.findUltimosCodigosBarrasPorLoja(LOJA_ID))
                .thenReturn(List.of("7890000000055")); // seq 5
        // Próximo deve ser seq 6: 7890000000062
        String esperado = ProdutoService.calcularEan13(6L);
        when(repository.existsByCodigoBarrasAndLojaId(esperado, LOJA_ID)).thenReturn(false);

        String ean = service.gerarProximoCodigoBarrasEan(LOJA_ID);
        assertThat(ean).isEqualTo(esperado);
    }

    @Test
    void criar_quandoSkuECodigoBarrasVazios_geraAutomaticamenteSequenciais() {
        when(repository.findUltimosSkusPorLoja(LOJA_ID)).thenReturn(List.of());
        when(repository.existsBySkuAndLojaId("PRD-000001", LOJA_ID)).thenReturn(false);

        when(repository.findUltimosCodigosBarrasPorLoja(LOJA_ID)).thenReturn(List.of());
        String eanEsperado = ProdutoService.calcularEan13(1L);
        when(repository.existsByCodigoBarrasAndLojaId(eanEsperado, LOJA_ID)).thenReturn(false);

        when(repository.save(any(Produto.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mapper.toResponse(any(Produto.class))).thenReturn(new ProdutoResponse());

        ProdutoRequest req = ProdutoRequest.builder()
                .sku("") // vazio proposital
                .codigoBarras(null)
                .nome("Armação Exemplo")
                .tipoProduto("ARMACAO")
                .precoVenda(new BigDecimal("199.90"))
                .build();

        service.criar(req);

        verify(repository).save(argThat(p ->
                "PRD-000001".equals(p.getSku()) &&
                eanEsperado.equals(p.getCodigoBarras())
        ));
    }
}
