package com.visionbox.shared.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * Validador CPF para Jakarta Validation + utilitários estáticos para uso programático em services.
 * <p>
 * Regras:
 * - normaliza removendo não-dígitos
 * - deve ter 11 dígitos
 * - não pode ter todos dígitos iguais (000..., 111...)
 * - valida dígitos verificadores módulo 11
 */
public class CpfValidator implements ConstraintValidator<Cpf, String> {

    private boolean allowNull;

    @Override
    public void initialize(Cpf constraintAnnotation) {
        this.allowNull = constraintAnnotation.allowNull();
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return allowNull;
        }
        String digits = normalize(value);
        // normalize already validates length; catch exception as invalid
        try {
            return isValidCpf(digits);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    // ---- utilitários estáticos para ClienteService / testes ----

    /**
     * Remove máscara e retorna apenas dígitos. Retorna "" se null/blank.
     * Valida que se houver dígitos deve ter 11 após normalização, caso contrário lança IllegalArgumentException.
     */
    public static String normalize(String cpf) {
        if (cpf == null) return "";
        String d = cpf.replaceAll("\\D", "");
        if (d.isEmpty()) return "";
        if (d.length() != 11) {
            throw new IllegalArgumentException("CPF deve ter 11 dígitos");
        }
        return d;
    }

    /** Normaliza sem validar tamanho (uso interno para checagem). */
    public static String normalizeLenient(String cpf) {
        if (cpf == null) return "";
        return cpf.replaceAll("\\D", "");
    }

    /**
     * Valida CPF com dígitos verificadores. Lança IllegalArgumentException com mensagem útil se inválido.
     */
    public static void validateOrThrow(String digits) {
        if (digits == null || digits.length() != 11) {
            throw new IllegalArgumentException("CPF deve ter 11 dígitos");
        }
        if (digits.chars().distinct().count() == 1) {
            throw new IllegalArgumentException("CPF inválido");
        }
        if (!hasValidCheckDigits(digits)) {
            throw new IllegalArgumentException("CPF inválido: dígito verificador incorreto");
        }
    }

    /** Retorna true se CPF é válido (11 dígitos + dígitos verificadores). */
    public static boolean isValidCpf(String digits) {
        if (digits == null || digits.length() != 11) return false;
        if (digits.chars().distinct().count() == 1) return false;
        return hasValidCheckDigits(digits);
    }

    /** Valida dígitos verificadores módulo 11. */
    public static boolean hasValidCheckDigits(String digits) {
        if (digits == null || digits.length() != 11) return false;
        // calcula primeiro dígito
        int sum = 0;
        for (int i = 0; i < 9; i++) {
            int num = digits.charAt(i) - '0';
            sum += num * (10 - i);
        }
        int r = sum % 11;
        int d1 = (r < 2) ? 0 : 11 - r;
        if (d1 != (digits.charAt(9) - '0')) return false;

        sum = 0;
        for (int i = 0; i < 10; i++) {
            int num = digits.charAt(i) - '0';
            sum += num * (11 - i);
        }
        r = sum % 11;
        int d2 = (r < 2) ? 0 : 11 - r;
        return d2 == (digits.charAt(10) - '0');
    }

    /** Valida entrada com máscara ou sem, lançando exceção se inválida. */
    public static String normalizeAndValidate(String cpfInput) {
        String digits = normalize(cpfInput);
        validateOrThrow(digits);
        return digits;
    }
}
