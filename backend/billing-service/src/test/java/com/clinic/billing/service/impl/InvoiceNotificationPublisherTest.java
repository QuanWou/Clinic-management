package com.clinic.billing.service.impl;

import com.clinic.billing.client.RecipientDirectoryClient;
import com.clinic.billing.entity.InvoicePaidOutbox;
import com.clinic.billing.repository.InvoicePaidOutboxRepository;
import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
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
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InvoiceNotificationPublisherTest {
    @Mock InvoicePaidOutboxRepository outbox;
    @Mock RabbitTemplate rabbit;
    @Mock RecipientDirectoryClient recipients;
    @InjectMocks InvoiceNotificationPublisher publisher;

    private InvoicePaidOutbox waitingEvent() {
        return InvoicePaidOutbox.builder().eventId(UUID.randomUUID()).invoiceId(UUID.randomUUID())
                .patientId(UUID.randomUUID()).eventType("INVOICE_PAID")
                .status("WAITING_RECIPIENT").nextAttemptAt(LocalDateTime.now().minusSeconds(1)).build();
    }

    @Test
    void walkInWithoutAccountIsSkippedWithoutSendingToBroker() {
        var event = waitingEvent();
        when(outbox.findByIdForUpdate(event.getEventId())).thenReturn(Optional.of(event));
        when(recipients.findLinkedUser(event.getPatientId())).thenReturn(Optional.empty());

        publisher.publish(event.getEventId());

        assertEquals("SKIPPED_NO_ACCOUNT", event.getStatus());
        assertEquals(null, event.getRecipientUserId());
        verifyNoInteractions(rabbit);
        publisher.publish(event.getEventId());
        verify(recipients, times(1)).findLinkedUser(event.getPatientId());
    }

    @Test
    void directoryOutageRetriesRatherThanMarkingWalkIn() {
        var event = waitingEvent();
        when(outbox.findByIdForUpdate(event.getEventId())).thenReturn(Optional.of(event));
        when(recipients.findLinkedUser(event.getPatientId()))
                .thenThrow(new BusinessException(ErrorCode.CONFLICT, "Directory offline"));

        publisher.publish(event.getEventId());

        assertEquals("WAITING_RECIPIENT", event.getStatus());
        assertEquals(1, event.getPublishAttempts());
        verifyNoInteractions(rabbit);
    }

    @Test
    void linkedPatientIsResolvedBeforeBrokerPublish() {
        var event = waitingEvent();
        UUID linkedUser = UUID.randomUUID();
        when(outbox.findByIdForUpdate(event.getEventId())).thenReturn(Optional.of(event));
        when(recipients.findLinkedUser(event.getPatientId())).thenReturn(Optional.of(linkedUser));

        publisher.publish(event.getEventId());

        assertEquals("PENDING", event.getStatus());
        assertEquals(linkedUser, event.getRecipientUserId());
        verifyNoInteractions(rabbit);
    }

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
