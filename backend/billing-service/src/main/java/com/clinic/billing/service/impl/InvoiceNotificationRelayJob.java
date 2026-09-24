package com.clinic.billing.service.impl;

import com.clinic.billing.repository.InvoicePaidOutboxRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class InvoiceNotificationRelayJob {
    private final InvoicePaidOutboxRepository outbox;
    private final InvoiceNotificationPublisher publisher;

    @Scheduled(fixedDelayString = "${app.notification.relay-interval-ms:10000}")
    public void relay() {
        LocalDateTime now = LocalDateTime.now();
        outbox.findTop50ByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAtAsc("WAITING_RECIPIENT", now)
                .forEach(event -> publisher.publish(event.getEventId()));
        outbox.findTop50ByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAtAsc("PENDING", now)
                .forEach(event -> publisher.publish(event.getEventId()));
    }
}
