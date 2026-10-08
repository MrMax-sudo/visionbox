package com.visionbox.modules.relatorios.service;

import com.visionbox.modules.relatorios.dto.CurvaAbcItemResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CurvaAbcClassifierTest {

    private static final UUID ID = UUID.fromString("00000000-0000-0000-0000-0000000000aa");

    @Test
    void classifica_faixas80e95PeloAcumulado() {
        // total 100: acumulado A=80 (A), B=95 (B), C=100 (C)
        List<AbcProduto> produtos = List.of(
                prod("C", "5.00"),
                prod("A", "80.00"),
                prod("B", "15.00"));

        List<CurvaAbcItemResponse> result = CurvaAbcClassifier.classificar(produtos);

        assertThat(result).extracting(CurvaAbcItemResponse::getClasse)
                .containsExactly("A", "B", "C");
        assertThat(result.get(0).getPercentualAcumulado()).isEqualByComparingTo("80.00");
        assertThat(result.get(1).getPercentualAcumulado()).isEqualByComparingTo("95.00");
        assertThat(result.get(2).getPercentualAcumulado()).isEqualByComparingTo("100.00");
        assertThat(result.get(0).getFaturamento()).isEqualByComparingTo("80.00");
    }

    @Test
    void classifica_ordenaPorFaturamentoDescMesmoComEntradaDesordenada() {
        List<AbcProduto> produtos = List.of(
                prod("Baixo", "10.00"),
                prod("Alto", "60.00"),
                prod("Medio", "30.00"));

        List<CurvaAbcItemResponse> result = CurvaAbcClassifier.classificar(produtos);

        assertThat(result).extracting(CurvaAbcItemResponse::getProdutoNome)
                .containsExactly("Alto", "Medio", "Baixo");
        assertThat(result.get(0).getParticipacaoPercentual()).isEqualByComparingTo("60.00");
        assertThat(result.get(1).getParticipacaoPercentual()).isEqualByComparingTo("30.00");
        assertThat(result.get(2).getParticipacaoPercentual()).isEqualByComparingTo("10.00");
    }

    @Test
    void classifica_desempatePorNomeQuandoFaturamentoIgual() {
        List<AbcProduto> produtos = List.of(
                prod("Zebra", "50.00"),
                prod("Alfa", "50.00"));

        List<CurvaAbcItemResponse> result = CurvaAbcClassifier.classificar(produtos);

        assertThat(result).extracting(CurvaAbcItemResponse::getProdutoNome)
                .containsExactly("Alfa", "Zebra");
    }

    @Test
    void classifica_acumuladoNoLimiteDe95EhClasseB() {
        // total 200: A=120 (60%), B=70 (95% acumulado) -> B; C=10 (100%) -> C
        List<AbcProduto> produtos = List.of(
                prod("C", "10.00"),
                prod("A", "120.00"),
                prod("B", "70.00"));

        List<CurvaAbcItemResponse> result = CurvaAbcClassifier.classificar(produtos);

        assertThat(result).extracting(CurvaAbcItemResponse::getClasse)
                .containsExactly("A", "B", "C");
        assertThat(result.get(1).getPercentualAcumulado()).isEqualByComparingTo("95.00");
    }

    @Test
    void classifica_acimaDe95EhClasseC() {
        // total 200: A=120, B=69 (94.5% -> B), C=11 (100% -> C)
        List<AbcProduto> produtos = List.of(
                prod("C", "11.00"),
                prod("A", "120.00"),
                prod("B", "69.00"));

        List<CurvaAbcItemResponse> result = CurvaAbcClassifier.classificar(produtos);

        assertThat(result).extracting(CurvaAbcItemResponse::getClasse)
                .containsExactly("A", "B", "C");
        assertThat(result.get(1).getPercentualAcumulado()).isEqualByComparingTo("94.50");
    }

    @Test
    void classifica_produtoUnicoEhClasseACom100Acumulado() {
        List<CurvaAbcItemResponse> result = CurvaAbcClassifier.classificar(List.of(prod("Unico", "123.45")));

        assertThat(result).hasSize(1);
        CurvaAbcItemResponse item = result.get(0);
        assertThat(item.getClasse()).isEqualTo("A");
        assertThat(item.getParticipacaoPercentual()).isEqualByComparingTo("100.00");
        assertThat(item.getPercentualAcumulado()).isEqualByComparingTo("100.00");
    }

    @Test
    void classifica_semFaturamento_retornaTudoClasseCComZero() {
        List<AbcProduto> produtos = List.of(
                prod("X", "0"),
                prod("Y", "0.00"));

        List<CurvaAbcItemResponse> result = CurvaAbcClassifier.classificar(produtos);

        assertThat(result).allSatisfy(item -> {
            assertThat(item.getClasse()).isEqualTo("C");
            assertThat(item.getParticipacaoPercentual()).isEqualByComparingTo("0.00");
            assertThat(item.getPercentualAcumulado()).isEqualByComparingTo("0.00");
        });
    }

    @Test
    void classificar_listaVazia_retornaVazio() {
        assertThat(CurvaAbcClassifier.classificar(List.of())).isEmpty();
        assertThat(CurvaAbcClassifier.classificar(null)).isEmpty();
    }

    private AbcProduto prod(String nome, String faturamento) {
        return new AbcProduto(ID, nome, "SKU-" + nome, new BigDecimal(faturamento));
    }
}