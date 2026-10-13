package com.visionbox.shared.validation;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CnpjValidatorTest {

    /** 11.222.333/0001-81 — dígitos verificadores válidos. */
    private static final String VALIDO = "11222333000181";

    @Test
    void isValidCnpj_digitoVerificadorCorreto_retornaTrue() {
        assertThat(CnpjValidator.isValidCnpj(VALIDO)).isTrue();
    }

    @Test
    void isValidCnpj_digitoVerificadorErrado_retornaFalse() {
        assertThat(CnpjValidator.isValidCnpj("11222333000182")).isFalse();
    }

    @Test
    void isValidCnpj_todosDigitosIguais_retornaFalse() {
        assertThat(CnpjValidator.isValidCnpj("11111111111111")).isFalse();
    }

    @Test
    void normalize_removeMascara() {
        assertThat(CnpjValidator.normalize("11.222.333/0001-81")).isEqualTo(VALIDO);
    }

    @Test
    void validateOrThrow_tamanhoErrado_lanca() {
        assertThatThrownBy(() -> CnpjValidator.validateOrThrow("123"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("14 dígitos");
    }

    @Test
    void format_geraMascaraPadrao() {
        assertThat(CnpjValidator.format(VALIDO)).isEqualTo("11.222.333/0001-81");
    }
}
