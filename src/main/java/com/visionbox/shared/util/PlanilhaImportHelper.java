package com.visionbox.shared.util;

import lombok.experimental.UtilityClass;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Slf4j
@UtilityClass
public class PlanilhaImportHelper {

    /**
     * Extrai as linhas de um arquivo de carga, seja ele Excel (.xlsx, .xls) ou CSV (.csv).
     * Retorna uma lista de linhas, onde cada linha é uma lista de strings das colunas.
     */
    public static List<List<String>> extrairLinhas(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            return Collections.emptyList();
        }

        String nomeOriginal = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        String contentType = file.getContentType() != null ? file.getContentType().toLowerCase() : "";

        boolean isExcel = nomeOriginal.endsWith(".xlsx") || nomeOriginal.endsWith(".xls")
                || contentType.contains("spreadsheet") || contentType.contains("excel");

        if (isExcel) {
            return extrairLinhasExcel(file);
        } else {
            return extrairLinhasCsv(file);
        }
    }

    private static List<List<String>> extrairLinhasExcel(MultipartFile file) throws IOException {
        List<List<String>> linhas = new ArrayList<>();
        DataFormatter formatter = new DataFormatter();

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getNumberOfSheets() > 0 ? workbook.getSheetAt(0) : null;
            if (sheet == null) {
                return linhas;
            }

            for (Row row : sheet) {
                List<String> colunas = new ArrayList<>();
                boolean linhaVazia = true;

                int maxCol = row.getLastCellNum();
                if (maxCol < 0) continue;

                for (int c = 0; c < maxCol; c++) {
                    Cell cell = row.getCell(c, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                    if (cell == null) {
                        colunas.add("");
                    } else {
                        String val = formatter.formatCellValue(cell).trim();
                        if (!val.isEmpty()) {
                            linhaVazia = false;
                        }
                        colunas.add(val);
                    }
                }

                if (!linhaVazia) {
                    linhas.add(colunas);
                }
            }
        } catch (Exception e) {
            log.error("Erro ao ler planilha Excel: {}", e.getMessage());
            throw new IOException("Falha ao processar arquivo Excel: " + e.getMessage(), e);
        }

        return linhas;
    }

    private static List<List<String>> extrairLinhasCsv(MultipartFile file) throws IOException {
        List<List<String>> linhas = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                // Remove eventual BOM do UTF-8
                if (line.startsWith("\uFEFF")) {
                    line = line.substring(1);
                }
                String trimmed = line.trim();
                if (trimmed.isEmpty()) continue;

                // Suporta delimitador ';' ou ','
                String[] split = line.contains(";") ? line.split(";", -1) : line.split(",", -1);
                List<String> colunas = new ArrayList<>();
                boolean linhaVazia = true;

                for (String c : split) {
                    String limpa = c.trim();
                    if (limpa.startsWith("\"") && limpa.endsWith("\"") && limpa.length() >= 2) {
                        limpa = limpa.substring(1, limpa.length() - 1).trim();
                    }
                    if (!limpa.isEmpty()) {
                        linhaVazia = false;
                    }
                    colunas.add(limpa);
                }

                if (!linhaVazia) {
                    linhas.add(colunas);
                }
            }
        }

        return linhas;
    }

    /**
     * Gera um modelo estilizado em Excel (.xlsx) com cabeçalhos profissionais e linhas de exemplo.
     */
    public static byte[] gerarModeloExcel(String tituloAba, List<String> cabecalhos, List<List<String>> linhasExemplo) throws IOException {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet(tituloAba != null && !tituloAba.isBlank() ? tituloAba : "Modelo");

            // Estilo do Cabeçalho
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerFont.setFontHeightInPoints((short) 11);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            headerStyle.setBorderBottom(BorderStyle.MEDIUM);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);

            // Estilo das Linhas de Dados
            CellStyle dataStyle = workbook.createCellStyle();
            Font dataFont = workbook.createFont();
            dataFont.setFontHeightInPoints((short) 10);
            dataStyle.setFont(dataFont);
            dataStyle.setBorderBottom(BorderStyle.THIN);
            dataStyle.setBorderTop(BorderStyle.THIN);
            dataStyle.setBorderLeft(BorderStyle.THIN);
            dataStyle.setBorderRight(BorderStyle.THIN);
            dataStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            // Linha de Cabeçalho
            Row headerRow = sheet.createRow(0);
            headerRow.setHeightInPoints(26);
            for (int i = 0; i < cabecalhos.size(); i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(cabecalhos.get(i));
                cell.setCellStyle(headerStyle);
            }

            // Linhas de Exemplo
            int rowIdx = 1;
            for (List<String> linha : linhasExemplo) {
                Row row = sheet.createRow(rowIdx++);
                row.setHeightInPoints(20);
                for (int i = 0; i < linha.size(); i++) {
                    Cell cell = row.createCell(i);
                    cell.setCellValue(linha.get(i));
                    cell.setCellStyle(dataStyle);
                }
            }

            // Autoajuste da largura das colunas
            for (int i = 0; i < cabecalhos.size(); i++) {
                sheet.autoSizeColumn(i);
                int larguraAtual = sheet.getColumnWidth(i);
                sheet.setColumnWidth(i, Math.max(larguraAtual + 1200, 4000));
            }

            workbook.write(out);
            return out.toByteArray();
        }
    }

    /**
     * Gera um modelo em formato CSV delimitado por ponto-e-vírgula com BOM UTF-8.
     */
    public static byte[] gerarModeloCsv(List<String> cabecalhos, List<List<String>> linhasExemplo) {
        StringBuilder sb = new StringBuilder();
        sb.append("\uFEFF"); // BOM UTF-8 para Excel abrir perfeitamente acentos
        sb.append(String.join(";", cabecalhos)).append("\r\n");

        for (List<String> linha : linhasExemplo) {
            sb.append(String.join(";", linha)).append("\r\n");
        }

        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }
}
