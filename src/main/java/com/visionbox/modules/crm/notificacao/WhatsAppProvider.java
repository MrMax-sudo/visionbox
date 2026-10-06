package com.visionbox.modules.crm.notificacao;

public interface WhatsAppProvider {

    WhatsAppSendResult send(WhatsAppMessage message);
}
