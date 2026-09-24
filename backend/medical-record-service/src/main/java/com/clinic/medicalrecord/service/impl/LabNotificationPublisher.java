package com.clinic.medicalrecord.service.impl;

import com.clinic.medicalrecord.dto.BusinessNotificationEvent;
import com.clinic.medicalrecord.client.RecipientDirectoryClient;
import com.clinic.medicalrecord.entity.LabEventOutbox;
import com.clinic.medicalrecord.repository.LabEventOutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class LabNotificationPublisher {
    private final LabEventOutboxRepository outbox;
    private final RabbitTemplate rabbit;
    private final RecipientDirectoryClient recipients;

    @Value("${app.notification.rabbitmq.exchange:notification.exchange}") private String exchange;
    @Value("${app.notification.rabbitmq.event-routing-key:notification.business}") private String routingKey;

    @Transactional
    public void publish(UUID id) {
        LabEventOutbox event = outbox.findByIdForUpdate(id).orElse(null);
        if (event == null || event.getNextAttemptAt().isAfter(LocalDateTime.now())) return;
        if ("WAITING_RECIPIENT".equals(event.getStatus())) {
            try {
                var linkedUser = recipients.findLinkedUser(event.getPatientId());
                if (linkedUser.isPresent()) event.recipientResolved(linkedUser.get());
                else event.skippedNoAccount();
            } catch (Exception ex) {
                event.failed(ex.getClass().getSimpleName());
                log.warn("Lab recipient lookup failed event={} attempt={}", id, event.getPublishAttempts());
            }
            // Commit recipient resolution before attempting delivery on the next relay pass.
            return;
        }
        if (!"PENDING".equals(event.getStatus()) || event.getRecipientUserId() == null) return;
        try {
            CorrelationData correlation = new CorrelationData(event.getId().toString());
            rabbit.convertAndSend(exchange, routingKey, new BusinessNotificationEvent(1, event.getId(),
                    event.getEventType(), event.getLabOrderId(), event.getRecipientUserId(), "IN_APP"), correlation);
            CorrelationData.Confirm confirm = correlation.getFuture().get(5, TimeUnit.SECONDS);
            if (!confirm.isAck() || correlation.getReturned() != null) {
                throw new IllegalStateException("Broker did not confirm and route event");
            }
            event.published();
        } catch (Exception ex) {
            if (ex instanceof InterruptedException) Thread.currentThread().interrupt();
            event.failed(ex.getClass().getSimpleName());
            log.warn("Lab notification publish failed event={} attempt={}", id, event.getPublishAttempts());
        }
    }
}
