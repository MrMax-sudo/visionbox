package com.visionbox.shared.crypto;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Service
public class CryptoService {

    private final String kekHex;
    private final String hmacPepper;

    public CryptoService(
            @Value("${visionbox.crypto.kek-hex:}") String kekHex,
            @Value("${visionbox.crypto.hmac-pepper:}") String hmacPepper) {
        this.kekHex = kekHex;
        this.hmacPepper = hmacPepper;
        if (kekHex != null && !kekHex.isBlank()) {
            System.setProperty("visionbox.crypto.kek-hex", kekHex);
        }
        if (hmacPepper != null && !hmacPepper.isBlank()) {
            System.setProperty("visionbox.crypto.hmac-pepper", hmacPepper);
        }
    }

    public byte[] encrypt(String plain) {
        return CpfConverter.encrypt(plain);
    }

    public String decrypt(byte[] cipher) {
        return CpfConverter.decrypt(cipher);
    }

    public String hash(String cpf) {
        return CpfConverter.hash(cpf);
    }

    public String mask(String cpfDigits) {
        if (cpfDigits == null) return null;
        String d = cpfDigits.replaceAll("\\D", "");
        if (d.length() != 11) return "***.***.***-**";
        return "***." + d.substring(3, 6) + "." + d.substring(6, 9) + "-**";
    }

    public boolean matches(String cpfPlain, String hashHex) {
        if (cpfPlain == null || hashHex == null) return false;
        String computed = hash(cpfPlain);
        return MessageDigest.isEqual(
                computed.getBytes(StandardCharsets.UTF_8),
                hashHex.getBytes(StandardCharsets.UTF_8));
    }
}
