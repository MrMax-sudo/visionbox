package com.visionbox.shared.validation;

/**
 * Validador de CNPJ — espelho do {@link CpfValidator} para o módulo de Fornecedores (R2/ADR-002).
 * <p>
 * Regras:
 * - normaliza removendo não-dígitos
 * - deve ter 14 dígitos
 * - não pode ter todos dígitos iguais (000..., 111...)
 * - valida dígitos verificadores módulo 11 (pesos 543298765432 / 6543298765432)
 */
public final class CnpjValidator {

    private CnpjValidator() {
    }

    /** Remove máscara; lança IllegalArgumentException se não tiver 14 dígitos. */
    public static String normalize(String cnpj) {
        if (cnpj == null) return "";
        String d = cnpj.replaceAll("\\D", "");
        if (d.isEmpty()) return "";
        if (d.length() != 14) {
            throw new IllegalArgumentException("CNPJ deve ter 14 dígitos");
        }
        return d;
    }

    /** Normaliza sem validar tamanho. */
    public static String normalizeLenient(String cnpj) {
        if (cnpj == null) return "";
        return cnpj.replaceAll("\\D", "");
    }

    /** Valida CNPJ com dígitos verificadores. Lança IllegalArgumentException se inválido. */
    public static void validateOrThrow(String digits) {
        if (digits == null || digits.length() != 14) {
            throw new IllegalArgumentException("CNPJ deve ter 14 dígitos");
        }
        if (digits.chars().distinct().count() == 1) {
            throw new IllegalArgumentException("CNPJ inválido");
        }
        if (!hasValidCheckDigits(digits)) {
            throw new IllegalArgumentException("CNPJ inválido: dígito verificador incorreto");
        }
    }

    /** true se 14 dígitos + dígitos verificadores válidos. */
    public static boolean isValidCnpj(String digits) {
        if (digits == null || digits.length() != 14) return false;
        if (digits.chars().distinct().count() == 1) return false;
        return hasValidCheckDigits(digits);
    }

    /** Valida os dois dígitos verificadores módulo 11. */
    public static boolean hasValidCheckDigits(String digits) {
        if (digits == null || digits.length() != 14) return false;
        int d1 = calcDv(digits, 12, 5);
        if (d1 != (digits.charAt(12) - '0')) return false;
        int d2 = calcDv(digits, 13, 6);
        return d2 == (digits.charAt(13) - '0');
    }

    private static int calcDv(String digits, int length, int startWeight) {
        int sum = 0;
        int weight = startWeight;
        for (int i = 0; i < length; i++) {
            sum += (digits.charAt(i) - '0') * weight;
            weight = (weight == 2) ? 9 : weight - 1;
        }
        int rest = sum % 11;
        return (rest < 2) ? 0 : 11 - rest;
    }

    /** Formata máscara XX.XXX.XXX/XXXX-XX. */
    public static String format(String digits) {
        if (digits == null || digits.length() != 14) return digits;
        return digits.substring(0, 2) + "." + digits.substring(2, 5) + "."
                + digits.substring(5, 8) + "/" + digits.substring(8, 12) + "-"
                + digits.substring(12);
    }
}
