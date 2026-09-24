package com.clinic.appointment.service;

import com.clinic.appointment.entity.AppointmentNotificationOutbox;
import com.clinic.appointment.repository.AppointmentNotificationOutboxRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AppointmentNotificationPublisherTest {
    @Mock AppointmentNotificationOutboxRepository outbox;
    @Mock RabbitTemplate rabbit;
    @InjectMocks AppointmentNotificationPublisher publisher;

    @Test
    void marksEventPublishedOnlyAfterBrokerAck() {
        var event = new AppointmentNotificationOutbox("APPOINTMENT_CREATED", UUID.randomUUID(), UUID.randomUUID());
        when(outbox.findByIdForUpdate(event.getId())).thenReturn(Optional.of(event));
        doAnswer(call -> {
            CorrelationData correlation = call.getArgument(3);
            correlation.getFuture().complete(new CorrelationData.Confirm(true, null));
            return null;
        }).when(rabbit).convertAndSend(nullable(String.class), nullable(String.class), any(Object.class), any(CorrelationData.class));

        publisher.publish(event.getId());

        assertEquals("PUBLISHED", event.getStatus());
        assertEquals(0, event.getPublishAttempts());
    }
}
