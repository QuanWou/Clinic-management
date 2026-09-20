package com.clinic.billing.service.impl;

import com.clinic.billing.dto.BusinessNotificationEvent;
import com.clinic.billing.entity.InvoicePaidOutbox;
import com.clinic.billing.repository.InvoicePaidOutboxRepository;
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
public class InvoiceNotificationPublisher {
    private final InvoicePaidOutboxRepository outbox;
    private final RabbitTemplate rabbit;
    @Value("${app.notification.rabbitmq.exchange:notification.exchange}") private String exchange;
    @Value("${app.notification.rabbitmq.event-routing-key:notification.business}") private String routingKey;

    @Transactional
    public void publish(UUID id) {
        InvoicePaidOutbox event = outbox.findByIdForUpdate(id).orElse(null);
        if (event == null || !"PENDING".equals(event.getStatus())
                || event.getNextAttemptAt().isAfter(LocalDateTime.now())) return;
        try {
            CorrelationData correlation = new CorrelationData(event.getEventId().toString());
            rabbit.convertAndSend(exchange, routingKey, new BusinessNotificationEvent(1, event.getEventId(),
                    event.getEventType(), event.getInvoiceId(), event.getRecipientUserId(), "IN_APP"), correlation);
            CorrelationData.Confirm confirm = correlation.getFuture().get(5, TimeUnit.SECONDS);
            if (!confirm.isAck() || correlation.getReturned() != null) {
                throw new IllegalStateException("Broker did not confirm and route event");
            }
            event.published();
        } catch (Exception ex) {
            if (ex instanceof InterruptedException) Thread.currentThread().interrupt();
            event.failed(ex.getClass().getSimpleName());
            log.warn("Invoice notification publish failed event={} attempt={}", id, event.getPublishAttempts());
        }
    }
}
