package com.visionbox.shared.crypto;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;

/**
 * ADR-002 — CpfConverter AES-256-GCM app-side.
 * Formato cipher: [1B ver][12B nonce][cipher][16B tag]
 */
@Converter(autoApply = false)
public class CpfConverter implements AttributeConverter<String, byte[]> {

    private static final Logger log = LoggerFactory.getLogger(CpfConverter.class);

    static final byte VERSION = 0x01;
    static final int NONCE_LEN = 12;
    static final int TAG_LEN = 16;
    static final int GCM_TAG_BITS = 128;
    private static final String AES_GCM = "AES/GCM/NoPadding";
    private static final String HMAC_ALGO = "HmacSHA256";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private static final String DEV_KEK_HEX = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
    private static final String DEV_PEPPER = "dev_hmac_pepper_change_in_prod";

    private static volatile SecretKeySpec cachedKey;
    private static volatile byte[] cachedPepper;

    @Override
    public byte[] convertToDatabaseColumn(String attribute) {
        if (attribute == null) return null;
        if (attribute.isBlank()) return null;
        return encryptInternal(attribute);
    }

    @Override
    public String convertToEntityAttribute(byte[] dbData) {
        if (dbData == null) return null;
        if (dbData.length == 0) return null;
        return decryptInternal(dbData);
    }

    public static String hash(String cpf) {
        if (cpf == null) return null;
        String norm = normalizeCpf(cpf);
        if (norm.isEmpty()) return null;
        try {
            Mac mac = Mac.getInstance(HMAC_ALGO);
            mac.init(new SecretKeySpec(getPepperBytes(), HMAC_ALGO));
            byte[] h = mac.doFinal(norm.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(h);
        } catch (Exception e) {
            throw new IllegalStateException("Falha HMAC CPF", e);
        }
    }

    public static byte[] encrypt(String plain) {
        if (plain == null) return null;
        return encryptInternal(plain);
    }

    public static String decrypt(byte[] cipher) {
        if (cipher == null) return null;
        return decryptInternal(cipher);
    }

    private static byte[] encryptInternal(String plain) {
        try {
            byte[] nonce = new byte[NONCE_LEN];
            SECURE_RANDOM.nextBytes(nonce);
            Cipher cipher = Cipher.getInstance(AES_GCM);
            cipher.init(Cipher.ENCRYPT_MODE, getKey(), new GCMParameterSpec(GCM_TAG_BITS, nonce));
            byte[] cipherAndTag = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[1 + NONCE_LEN + cipherAndTag.length];
            out[0] = VERSION;
            System.arraycopy(nonce, 0, out, 1, NONCE_LEN);
            System.arraycopy(cipherAndTag, 0, out, 1 + NONCE_LEN, cipherAndTag.length);
            return out;
        } catch (Exception e) {
            throw new IllegalStateException("Encrypt AES-GCM falhou", e);
        }
    }

    private static String decryptInternal(byte[] dbData) {
        try {
            if (dbData.length < 1 + NONCE_LEN + TAG_LEN + 1) {
                throw new IllegalArgumentException("Cipher muito curto: " + dbData.length);
            }
            byte ver = dbData[0];
            if (ver != VERSION) {
                throw new IllegalArgumentException("Versão cipher não suportada: " + ver);
            }
            byte[] nonce = new byte[NONCE_LEN];
            System.arraycopy(dbData, 1, nonce, 0, NONCE_LEN);
            int ctLen = dbData.length - 1 - NONCE_LEN;
            byte[] cipherAndTag = new byte[ctLen];
            System.arraycopy(dbData, 1 + NONCE_LEN, cipherAndTag, 0, ctLen);
            Cipher cipher = Cipher.getInstance(AES_GCM);
            cipher.init(Cipher.DECRYPT_MODE, getKey(), new GCMParameterSpec(GCM_TAG_BITS, nonce));
            byte[] plain = cipher.doFinal(cipherAndTag);
            return new String(plain, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Decrypt AES-GCM falhou", e);
        }
    }

    static String normalizeCpf(String cpf) {
        String digits = cpf.replaceAll("\\D", "");
        if (digits.isEmpty()) return "";
        if (digits.length() != 11) {
            throw new IllegalArgumentException("CPF deve ter 11 dígitos após normalização, recebido: " + digits.length());
        }
        return digits;
    }

    private static SecretKeySpec getKey() {
        if (cachedKey != null) return cachedKey;
        synchronized (CpfConverter.class) {
            if (cachedKey != null) return cachedKey;
            String hex = resolveKekHex();
            byte[] keyBytes = hexToBytes(hex);
            if (keyBytes.length != 32) {
                throw new IllegalStateException("CRYPTO_KEK_HEX deve ter 64 hex chars (256-bit), recebido " + keyBytes.length * 2);
            }
            cachedKey = new SecretKeySpec(keyBytes, "AES");
            if (isDevKey(hex)) {
                log.warn("AVISO SEGURANÇA: usando KEK DEV fallback — defina VISIONBOX_CRYPTO_KEK_HEX em prod");
            }
            return cachedKey;
        }
    }

    private static byte[] getPepperBytes() {
        if (cachedPepper != null) return cachedPepper;
        synchronized (CpfConverter.class) {
            if (cachedPepper != null) return cachedPepper;
            String pepper = resolvePepper();
            cachedPepper = pepper.getBytes(StandardCharsets.UTF_8);
            if (DEV_PEPPER.equals(pepper)) {
                log.warn("AVISO SEGURANÇA: usando HMAC pepper DEV");
            }
            return cachedPepper;
        }
    }

    private static String resolveKekHex() {
        String v = System.getenv("CRYPTO_KEK_HEX");
        if (isBlank(v)) v = System.getenv("VISIONBOX_CRYPTO_KEK_HEX");
        if (isBlank(v)) v = System.getProperty("visionbox.crypto.kek-hex");
        if (isBlank(v)) return DEV_KEK_HEX;
        return v.trim().toLowerCase();
    }

    private static String resolvePepper() {
        String v = System.getenv("CRYPTO_HMAC_PEPPER");
        if (isBlank(v)) v = System.getenv("VISIONBOX_CRYPTO_HMAC_PEPPER");
        if (isBlank(v)) v = System.getProperty("visionbox.crypto.hmac-pepper");
        if (isBlank(v)) return DEV_PEPPER;
        return v;
    }

    private static byte[] hexToBytes(String hex) {
        String clean = hex.replaceAll("\\s", "").toLowerCase();
        if (clean.startsWith("0x")) clean = clean.substring(2);
        return HexFormat.of().parseHex(clean);
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }
    private static boolean isDevKey(String hex) { return DEV_KEK_HEX.equalsIgnoreCase(hex); }

    static void clearCacheForTests() {
        cachedKey = null;
        cachedPepper = null;
    }
}
