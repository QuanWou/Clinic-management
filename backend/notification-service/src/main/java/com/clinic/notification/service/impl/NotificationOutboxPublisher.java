package com.clinic.notification.service.impl;

import com.clinic.notification.config.NotificationRabbitProperties;
import com.clinic.notification.dto.NotificationDeliveryMessage;
import com.clinic.notification.entity.Notification;
import com.clinic.notification.entity.NotificationStatus;
import com.clinic.notification.repository.NotificationRepository;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A durable notification row doubles as an outbox entry: no Rabbit publish happens before DB commit. */
@Service
@Slf4j
@RequiredArgsConstructor
public class NotificationOutboxPublisher {
    private static final int MAX_PUBLISH_FAILURES = 5;
    private final NotificationRepository repository;
    private final RabbitTemplate rabbitTemplate;
    private final NotificationRabbitProperties properties;

    @Transactional
    public void publishOne(UUID id) {
        Notification notification = repository.findByIdForUpdate(id).orElse(null);
        Instant now = Instant.now();
        if (notification == null || notification.getStatus() != NotificationStatus.PENDING
                || notification.getNextAttemptAt().isAfter(now)
                || (notification.getLastEnqueuedAt() != null
                    && notification.getLastEnqueuedAt().isAfter(now.minusSeconds(60)))) {
            return;
        }
        try {
            CorrelationData correlation = new CorrelationData(id.toString());
            rabbitTemplate.convertAndSend(properties.exchange(), properties.routingKey(),
                    new NotificationDeliveryMessage(id), correlation);
            CorrelationData.Confirm confirm = correlation.getFuture().get(5, TimeUnit.SECONDS);
            if (!confirm.isAck() || correlation.getReturned() != null) {
                throw new IllegalStateException("Broker did not confirm and route notification");
            }
            notification.setLastEnqueuedAt(Instant.now());
            notification.setPublishFailures(0);
            log.debug("Notification queued id={}", id);
        } catch (Exception error) {
            if (error instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            int failures = notification.getPublishFailures() + 1;
            notification.setPublishFailures(failures);
            if (failures >= MAX_PUBLISH_FAILURES) {
                notification.setStatus(NotificationStatus.FAILED);
            } else {
                notification.setNextAttemptAt(Instant.now().plusSeconds(15L * (1L << (failures - 1))));
            }
            log.warn("Notification publish failed id={} attempt={} final={} cause={}", id, failures,
                    notification.getStatus() == NotificationStatus.FAILED,
                    error.getClass().getSimpleName());
        }
    }
}
