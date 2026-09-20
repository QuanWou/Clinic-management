package com.clinic.medicalrecord.service.impl;

import com.clinic.medicalrecord.entity.LabEventOutbox;
import com.clinic.medicalrecord.repository.LabEventOutboxRepository;
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
class LabNotificationPublisherTest {
    @Mock LabEventOutboxRepository outbox;
    @Mock RabbitTemplate rabbit;
    @InjectMocks LabNotificationPublisher publisher;

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
