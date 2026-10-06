package com.visionbox.modules.crm.notificacao;

public class WhatsAppProviderException extends RuntimeException {

    public WhatsAppProviderException(String message) {
        super(message);
    }

    public WhatsAppProviderException(String message, Throwable cause) {
        super(message, cause);
    }
}
