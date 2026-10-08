package com.visionbox.modules.financeiro.service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * OfxParser — parser mínimo de extrato OFX (formato SGML clássico e XML até 3.x).
 * <p>
 * Extrai blocos {@code <STMTTRN>}: TRNTYPE, DTPOSTED, TRNAMT, FITID, MEMO.
 * Tolerante a:
 * - tags sem fechamento ({@code <TRNTYPE>XFER>} — estilo SGML) e com fechamento XML
 * - DTPOSTED com horário/timezone ({@code 20261005120000[-5:GMT]})
 * - TRNAMT brasileiro com vírgula ({@code 1.234,56} e {@code 1234,56})
 * - FITID ausente -> gerado {@code AUTO-<sha256>} determinístico do conteúdo
 *   (dedup estável em reimportação do mesmo arquivo)
 * <p>
 * Transação inválida (sem TRNAMT ou DTPOSTED) é ignorada e reportada em {@code erros}.
 */
public final class OfxParser {

    private static final Pattern TAG_VALUE = Pattern.compile("<([A-Z0-9_.]+)>\\s*([^<>]*)", Pattern.CASE_INSENSITIVE);
    private static final Pattern STMTTRN_INICIO = Pattern.compile("<STMTTRN>", Pattern.CASE_INSENSITIVE);

    private static final DateTimeFormatter DTPOSTED_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter DTPOSTED_ISO_FMT = DateTimeFormatter.ISO_LOCAL_DATE;

    private OfxParser() {
    }

    public record Transacao(String trnTipo, LocalDate dataPostamento, BigDecimal valor, String memo, String fitId) {
    }

    public record Resultado(List<Transacao> transacoes, List<String> erros) {
    }

    public static Resultado parse(String conteudo) {
        List<String> erros = new ArrayList<>();
        if (conteudo == null || conteudo.isBlank()) {
            return new Resultado(List.of(), List.of("Conteúdo OFX vazio"));
        }

        List<Transacao> transacoes = new ArrayList<>();
        List<String> blocos = splitStmtTrn(conteudo);
        if (blocos.isEmpty()) {
            // OFX sem <STMTTRN> (ex.: extrato vazio) — não é erro fatal, apenas sem linhas.
            return new Resultado(List.of(), erros);
        }

        for (int i = 0; i < blocos.size(); i++) {
            String bloco = blocos.get(i);
            try {
                transacoes.add(parseBloco(bloco));
            } catch (TransacaoInvalidaException e) {
                erros.add("Transação #" + (i + 1) + ": " + e.getMessage());
            }
        }
        return new Resultado(transacoes, erros);
    }

    /** Divide o conteúdo em blocos STMTTRN, aceitando ausência de fechamento </STMTTRN>. */
    private static List<String> splitStmtTrn(String conteudo) {
        List<String> blocos = new ArrayList<>();
        Matcher m = STMTTRN_INICIO.matcher(conteudo);
        int ultimoFim = -1;
        while (m.find()) {
            if (ultimoFim >= 0) {
                blocos.add(conteudo.substring(ultimoFim, m.start()));
            }
            ultimoFim = m.end();
        }
        if (ultimoFim >= 0) {
            blocos.add(conteudo.substring(ultimoFim));
        }
        return blocos;
    }

    private static Transacao parseBloco(String bloco) throws TransacaoInvalidaException {
        String trnTipo = extrair(bloco, "TRNTYPE");
        String dtRaw = extrair(bloco, "DTPOSTED");
        String amtRaw = extrair(bloco, "TRNAMT");
        String fitIdRaw = extrair(bloco, "FITID");
        String memo = extrair(bloco, "MEMO");

        if (dtRaw == null || dtRaw.isBlank()) {
            throw new TransacaoInvalidaException("DTPOSTED ausente");
        }
        if (amtRaw == null || amtRaw.isBlank()) {
            throw new TransacaoInvalidaException("TRNAMT ausente");
        }

        LocalDate data = parseDataPostada(dtRaw.trim());
        BigDecimal valor = parseTrnAmt(amtRaw.trim());
        String fitId = fitIdRaw != null && !fitIdRaw.isBlank()
                ? fitIdRaw.trim()
                : gerarFitId(data, valor, memo);
        return new Transacao(
                trnTipo != null ? trnTipo.trim() : null,
                data,
                valor,
                memo != null ? memo.trim() : null,
                fitId);
    }

    /** Retorna o primeiro valor da tag ou null. Resolve `TAG>x` e `TAG>x</TAG>`. */
    private static String extrair(String bloco, String tag) {
        Matcher m = TAG_VALUE.matcher(bloco);
        while (m.find()) {
            if (tag.equalsIgnoreCase(m.group(1))) {
                String valor = m.group(2).trim();
                return valor.isEmpty() ? null : valor;
            }
        }
        return null;
    }

    /** aceita 20261001, 20261001120000[-5:GMT] e (fallback) 2026-10-01. */
    private static LocalDate parseDataPostada(String raw) throws TransacaoInvalidaException {
        String s = raw;
        Matcher m = Pattern.compile("(\\d{8})").matcher(s);
        if (m.find()) {
            try {
                return LocalDate.parse(m.group(1), DTPOSTED_FMT);
            } catch (DateTimeParseException e) {
                throw new TransacaoInvalidaException("DTPOSTED inválido: " + raw);
            }
        }
        try {
            return LocalDate.parse(raw, DTPOSTED_ISO_FMT);
        } catch (DateTimeParseException e) {
            throw new TransacaoInvalidaException("DTPOSTED inválido: " + raw);
        }
    }

    /** TRNAMT: "1234.56", "1234,56", "1.234,56" (pt-BR), "-150.25". */
    private static BigDecimal parseTrnAmt(String raw) throws TransacaoInvalidaException {
        String s = raw.replace(" ", "").replace("\t", "");
        try {
            if (s.contains(",") && s.contains(".")) {
                // "1.234,56" -> mantém decimal BR; "1,234.56" -> decimal US
                if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
                    s = s.replace(".", "").replace(',', '.');
                } else {
                    s = s.replace(",", "");
                }
            } else if (s.contains(",")) {
                s = s.replace(',', '.');
            }
            return new BigDecimal(s);
        } catch (NumberFormatException e) {
            throw new TransacaoInvalidaException("TRNAMT inválido: " + raw);
        }
    }

    /** FITID sintético determinístico para arquivos sem FITID (dedup estável). */
    private static String gerarFitId(LocalDate data, BigDecimal valor, String memo) {
        String base = data + "|" + valor.toPlainString() + "|" + (memo != null ? memo : "");
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(base.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder("AUTO-");
            for (int i = 0; i < 16; i++) {
                sb.append(String.format("%02x", hash[i] & 0xff));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível", e);
        }
    }

    private static final class TransacaoInvalidaException extends Exception {
        TransacaoInvalidaException(String message) {
            super(message);
        }
    }
}