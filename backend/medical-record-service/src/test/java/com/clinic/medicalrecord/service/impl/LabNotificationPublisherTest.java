package com.clinic.medicalrecord.service.impl;

import com.clinic.medicalrecord.client.RecipientDirectoryClient;
import com.clinic.medicalrecord.entity.LabEventOutbox;
import com.clinic.medicalrecord.repository.LabEventOutboxRepository;
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
class LabNotificationPublisherTest {
    @Mock LabEventOutboxRepository outbox;
    @Mock RabbitTemplate rabbit;
    @Mock RecipientDirectoryClient recipients;
    @InjectMocks LabNotificationPublisher publisher;

    private LabEventOutbox waitingEvent() {
        return new LabEventOutbox(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                null, LocalDateTime.now().minusSeconds(1));
    }

    @Test
    void walkInWithoutAccountDoesNotReceiveLabNotification() {
        var event = waitingEvent();
        when(outbox.findByIdForUpdate(event.getId())).thenReturn(Optional.of(event));
        when(recipients.findLinkedUser(event.getPatientId())).thenReturn(Optional.empty());

        publisher.publish(event.getId());

        assertEquals("SKIPPED_NO_ACCOUNT", event.getStatus());
        verifyNoInteractions(rabbit);
        publisher.publish(event.getId());
        verify(recipients, times(1)).findLinkedUser(event.getPatientId());
    }

    @Test
    void unavailableRecipientDirectorySchedulesLabRetry() {
        var event = waitingEvent();
        when(outbox.findByIdForUpdate(event.getId())).thenReturn(Optional.of(event));
        when(recipients.findLinkedUser(event.getPatientId()))
                .thenThrow(new BusinessException(ErrorCode.CONFLICT, "Directory offline"));

        publisher.publish(event.getId());

        assertEquals("WAITING_RECIPIENT", event.getStatus());
        assertEquals(1, event.getPublishAttempts());
        verifyNoInteractions(rabbit);
    }

    @Test
    void linkedPatientReceivesResolvedLabNotificationOnNextRelay() {
        var event = waitingEvent();
        UUID linkedUser = UUID.randomUUID();
        when(outbox.findByIdForUpdate(event.getId())).thenReturn(Optional.of(event));
        when(recipients.findLinkedUser(event.getPatientId())).thenReturn(Optional.of(linkedUser));

        publisher.publish(event.getId());

        assertEquals("PENDING", event.getStatus());
        assertEquals(linkedUser, event.getRecipientUserId());
        verifyNoInteractions(rabbit);
    }

    @Test
    void schedulesRetryWhenBrokerNacks() {
        var event = new LabEventOutbox(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), LocalDateTime.now());
        when(outbox.findByIdForUpdate(event.getId())).thenReturn(Optional.of(event));
        doAnswer(call -> {
            CorrelationData correlation = call.getArgument(3);
            correlation.getFuture().complete(new CorrelationData.Confirm(false, "unavailable"));
            return null;
        }).when(rabbit).convertAndSend(nullable(String.class), nullable(String.class), any(Object.class), any(CorrelationData.class));

        publisher.publish(event.getId());

        assertEquals("PENDING", event.getStatus());
        assertEquals(1, event.getPublishAttempts());
    }
}
