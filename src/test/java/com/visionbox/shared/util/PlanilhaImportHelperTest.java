package com.visionbox.shared.util;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PlanilhaImportHelperTest {

    @Test
    void extrairLinhasCsv_leArquivoComDelimitadorPontoEVirgula() throws IOException {
        String csv = "Nome;CPF;Telefone\nJoão da Silva;12345678900;1199998888\nMaria Santos;98765432100;11988887777";
        MockMultipartFile file = new MockMultipartFile("file", "clientes.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        List<List<String>> linhas = PlanilhaImportHelper.extrairLinhas(file);
        assertThat(linhas).hasSize(3);
        assertThat(linhas.get(0)).containsExactly("Nome", "CPF", "Telefone");
        assertThat(linhas.get(1)).containsExactly("João da Silva", "12345678900", "1199998888");
    }

    @Test
    void gerarEExtrairExcel_geraELePlanilhaXlsxPerfeitamente() throws IOException {
        List<String> cabecalhos = List.of("SKU", "Nome", "Preco");
        List<List<String>> exemplos = List.of(
                List.of("PRD-000001", "Armação Ray-Ban", "450.00"),
                List.of("PRD-000002", "Lente Crizal", "320.00")
        );

        byte[] xlsxBytes = PlanilhaImportHelper.gerarModeloExcel("Produtos", cabecalhos, exemplos);
        assertThat(xlsxBytes).isNotEmpty();

        MockMultipartFile file = new MockMultipartFile(
                "file", "produtos.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                xlsxBytes
        );

        List<List<String>> linhasLidas = PlanilhaImportHelper.extrairLinhas(file);
        assertThat(linhasLidas).hasSize(3); // 1 cabecalho + 2 linhas
        assertThat(linhasLidas.get(0)).containsExactly("SKU", "Nome", "Preco");
        assertThat(linhasLidas.get(1).get(0)).isEqualTo("PRD-000001");
        assertThat(linhasLidas.get(1).get(1)).isEqualTo("Armação Ray-Ban");
        assertThat(linhasLidas.get(2).get(0)).isEqualTo("PRD-000002");
    }
}
