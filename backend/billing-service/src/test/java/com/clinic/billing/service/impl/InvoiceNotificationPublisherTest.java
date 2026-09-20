package com.clinic.billing.service.impl;

import com.clinic.billing.entity.InvoicePaidOutbox;
import com.clinic.billing.repository.InvoicePaidOutboxRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InvoiceNotificationPublisherTest {
    @Mock InvoicePaidOutboxRepository outbox;
    @Mock RabbitTemplate rabbit;
    @InjectMocks InvoiceNotificationPublisher publisher;

    @Test
    void marksEventPublishedAfterBrokerAck() {
        UUID eventId = UUID.randomUUID();
        var event = InvoicePaidOutbox.builder().eventId(eventId).invoiceId(UUID.randomUUID())
                .patientId(UUID.randomUUID()).eventType("INVOICE_PAID").status("PENDING")
                .recipientUserId(UUID.randomUUID()).nextAttemptAt(LocalDateTime.now()).build();
        when(outbox.findByIdForUpdate(eventId)).thenReturn(Optional.of(event));
        doAnswer(call -> {
            CorrelationData correlation = call.getArgument(3);
            correlation.getFuture().complete(new CorrelationData.Confirm(true, null));
            return null;
        }).when(rabbit).convertAndSend(nullable(String.class), nullable(String.class), any(Object.class), any(CorrelationData.class));

        publisher.publish(eventId);

        assertEquals("PUBLISHED", event.getStatus());
        assertEquals(0, event.getPublishAttempts());
    }
}
