package com.visionbox.shared.idempotency;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("OutboxMessage — offline fiscal e retry")
class OutboxMessageTest {

    @Test
    @DisplayName("FAILED continua pendente e incrementa tentativas para retry")
    void failedContinuaPendenteParaRetry() {
        OutboxMessage message = OutboxMessage.builder()
                .aggregateType("DOCUMENTO_FISCAL")
                .aggregateId("nfce-001")
                .eventType("FISCAL_CONTINGENCIA_EMITIR")
                .payload("{\"tpEmis\":\"9\"}")
                .status(OutboxMessage.Status.PENDING)
                .build();
        OffsetDateTime proxima = OffsetDateTime.parse("2026-09-05T13:00:00-03:00");

        message.markFailed("timeout sefaz", proxima);

        assertThat(message.getStatus()).isEqualTo(OutboxMessage.Status.FAILED);
        assertThat(message.isPending()).isTrue();
        assertThat(message.getTentativas()).isEqualTo(1);
        assertThat(message.getErroUltimo()).isEqualTo("timeout sefaz");
        assertThat(message.getProximaTentativa()).isEqualTo(proxima);
    }

    @Test
    @DisplayName("SENT deixa de ser pendente e limpa ultimo erro")
    void sentNaoFicaPendente() {
        OutboxMessage message = OutboxMessage.builder()
                .aggregateType("PEDIDO_VENDA")
                .aggregateId("pedido-001")
                .eventType("PDV_FINALIZADO")
                .payload("{}")
                .status(OutboxMessage.Status.FAILED)
                .erroUltimo("rabbit offline")
                .tentativas(2)
                .build();

        message.markSent();

        assertThat(message.getStatus()).isEqualTo(OutboxMessage.Status.SENT);
        assertThat(message.isPending()).isFalse();
        assertThat(message.getEnviadoEm()).isNotNull();
        assertThat(message.getErroUltimo()).isNull();
        assertThat(message.getTentativas()).isEqualTo(2);
    }
}
