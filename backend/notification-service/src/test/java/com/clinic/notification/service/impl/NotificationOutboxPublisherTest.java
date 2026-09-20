package com.clinic.notification.service.impl;

import com.clinic.notification.config.NotificationRabbitProperties;
import com.clinic.notification.dto.NotificationDeliveryMessage;
import com.clinic.notification.entity.Notification;
import com.clinic.notification.entity.NotificationStatus;
import com.clinic.notification.entity.NotificationType;
import com.clinic.notification.repository.NotificationRepository;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class NotificationOutboxPublisherTest {
    private final NotificationRepository repository = mock(NotificationRepository.class);
    private final RabbitTemplate rabbit = mock(RabbitTemplate.class);
    private final NotificationOutboxPublisher publisher = new NotificationOutboxPublisher(repository, rabbit,
            new NotificationRabbitProperties("notification.exchange", "notification.delivery.queue", "notification.delivery"));

    @Test
    void publishesOnlyIdAndRecordsBrokerConfirmation() {
        Notification notification = pending();
        when(repository.findByIdForUpdate(notification.getId())).thenReturn(Optional.of(notification));
        doAnswer(call -> {
            CorrelationData correlation = call.getArgument(3);
            correlation.getFuture().complete(new CorrelationData.Confirm(true, null));
            return null;
        }).when(rabbit).convertAndSend(anyString(), anyString(), any(Object.class), any(CorrelationData.class));
        publisher.publishOne(notification.getId());
        ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
        verify(rabbit).convertAndSend(anyString(), anyString(), payload.capture(), any(CorrelationData.class));
        assertThat(payload.getValue()).isInstanceOf(NotificationDeliveryMessage.class);
        assertThat(((NotificationDeliveryMessage) payload.getValue()).notificationId()).isEqualTo(notification.getId());
        assertThat(notification.getLastEnqueuedAt()).isNotNull();
        assertThat(notification.getStatus()).isEqualTo(NotificationStatus.PENDING);
        publisher.publishOne(notification.getId());
        verify(rabbit, times(1)).convertAndSend(anyString(), anyString(), any(Object.class), any(CorrelationData.class));
    }

    @Test
    void retriesThenMarksTerminalFailureWithoutClaimingSent() {
        Notification notification = pending();
        when(repository.findByIdForUpdate(notification.getId())).thenReturn(Optional.of(notification));
        doThrow(new IllegalStateException("Broker unreachable"))
                .when(rabbit).convertAndSend(anyString(), anyString(), any(Object.class), any(CorrelationData.class));
        for (int attempt = 1; attempt <= 5; attempt++) {
            notification.setNextAttemptAt(Instant.now().minusSeconds(1));
            publisher.publishOne(notification.getId());
            assertThat(notification.getPublishFailures()).isEqualTo(attempt);
        }
        assertThat(notification.getStatus()).isEqualTo(NotificationStatus.FAILED);
        assertThat(notification.getSentAt()).isNull();
        publisher.publishOne(notification.getId());
        verify(rabbit, times(5)).convertAndSend(anyString(), anyString(), any(Object.class), any(CorrelationData.class));
    }

    @Test
    void brokerNackDoesNotSetSentAndSchedulesRetry() {
        Notification notification = pending();
        when(repository.findByIdForUpdate(notification.getId())).thenReturn(Optional.of(notification));
        doAnswer(call -> {
            CorrelationData correlation = call.getArgument(3);
            correlation.getFuture().complete(new CorrelationData.Confirm(false, "broker rejected"));
            return null;
        }).when(rabbit).convertAndSend(anyString(), anyString(), any(Object.class), any(CorrelationData.class));
        publisher.publishOne(notification.getId());
        assertThat(notification.getStatus()).isEqualTo(NotificationStatus.PENDING);
        assertThat(notification.getSentAt()).isNull();
        assertThat(notification.getPublishFailures()).isEqualTo(1);
        assertThat(notification.getNextAttemptAt()).isAfter(Instant.now());
        publisher.publishOne(notification.getId());
        verify(rabbit, times(1)).convertAndSend(anyString(), anyString(), any(Object.class), any(CorrelationData.class));
    }

    @Test
    void staleConfirmedPublicationCanBeRepublishedWithSameIdAfterCrash() {
        Notification notification = pending();
        when(repository.findByIdForUpdate(notification.getId())).thenReturn(Optional.of(notification));
        doAnswer(call -> {
            CorrelationData correlation = call.getArgument(3);
            correlation.getFuture().complete(new CorrelationData.Confirm(true, null));
            return null;
        }).when(rabbit).convertAndSend(anyString(), anyString(), any(Object.class), any(CorrelationData.class));
        publisher.publishOne(notification.getId());
        notification.setLastEnqueuedAt(Instant.now().minusSeconds(61));
        publisher.publishOne(notification.getId());
        ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
        verify(rabbit, times(2)).convertAndSend(anyString(), anyString(), payload.capture(), any(CorrelationData.class));
        assertThat(payload.getAllValues()).allSatisfy(message ->
                assertThat(((NotificationDeliveryMessage) message).notificationId()).isEqualTo(notification.getId()));
        assertThat(notification.getStatus()).isEqualTo(NotificationStatus.PENDING);
    }

    private Notification pending() {
        return Notification.builder().id(UUID.randomUUID()).recipient("patient@example.com")
                .subject("Visit").content("Visit updated").type(NotificationType.EMAIL)
                .status(NotificationStatus.PENDING).nextAttemptAt(Instant.now().minusSeconds(1)).build();
    }
}
