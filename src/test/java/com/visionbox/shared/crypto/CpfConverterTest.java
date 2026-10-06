package com.visionbox.shared.crypto;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class CpfConverterTest {

    private final CpfConverter converter = new CpfConverter();

    @BeforeEach
    void setup() {
        System.setProperty("visionbox.crypto.kek-hex", "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff");
        System.setProperty("visionbox.crypto.hmac-pepper", "test_pepper_2026_unit");
        CpfConverter.clearCacheForTests();
    }

    @AfterEach
    void tearDown() {
        CpfConverter.clearCacheForTests();
    }

    @Test
    void roundtripEncryptDecrypt() {
        String cpf = "52998224725";
        byte[] cipher = converter.convertToDatabaseColumn(cpf);
        assertThat(cipher).isNotNull();
        assertThat(cipher[0]).isEqualTo((byte) 0x01);
        assertThat(cipher.length).isGreaterThan(1 + 12 + 16);
        String plain = converter.convertToEntityAttribute(cipher);
        assertThat(plain).isEqualTo(cpf);
    }

    @Test
    void hashDeterministicoEDiferentePorCpf() {
        String h1 = CpfConverter.hash("52998224725");
        String h2 = CpfConverter.hash("52998224725");
        String h3 = CpfConverter.hash("11144477735");
        assertThat(h1).hasSize(64).matches("[0-9a-f]{64}");
        assertThat(h1).isEqualTo(h2);
        assertThat(h1).isNotEqualTo(h3);
    }

    @Test
    void hashNormalizaDigitos() {
        assertThat(CpfConverter.hash("529.982.247-25"))
                .isEqualTo(CpfConverter.hash("52998224725"))
                .isEqualTo(CpfConverter.hash(" 529 982 247 25 "));
    }

    @Test
    void nullHandling() {
        assertThat(converter.convertToDatabaseColumn(null)).isNull();
        assertThat(converter.convertToEntityAttribute(null)).isNull();
        assertThat(CpfConverter.hash(null)).isNull();
    }

    @Test
    void dadoAdulteradoFalhaNoGCM() {
        byte[] cipher = converter.convertToDatabaseColumn("52998224725");
        cipher[cipher.length - 1] ^= 0x01;
        assertThatThrownBy(() -> converter.convertToEntityAttribute(cipher))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void nonceAleatorioGeraCipherDiferenteMesmoPlain() {
        byte[] c1 = converter.convertToDatabaseColumn("52998224725");
        byte[] c2 = converter.convertToDatabaseColumn("52998224725");
        assertThat(c1).isNotEqualTo(c2);
        assertThat(converter.convertToEntityAttribute(c1)).isEqualTo(converter.convertToEntityAttribute(c2));
    }
}
