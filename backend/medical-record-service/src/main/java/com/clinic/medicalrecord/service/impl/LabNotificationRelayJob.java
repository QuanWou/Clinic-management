package com.clinic.medicalrecord.service.impl;

import com.clinic.medicalrecord.repository.LabEventOutboxRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class LabNotificationRelayJob {
    private final LabEventOutboxRepository outbox;
    private final LabNotificationPublisher publisher;

    @Scheduled(fixedDelayString = "${app.notification.relay-interval-ms:10000}")
    public void relay() {
        outbox.findTop50ByStatusAndNextAttemptAtLessThanEqualOrderByOccurredAtAsc("PENDING", LocalDateTime.now())
                .forEach(event -> publisher.publish(event.getId()));
    }
}
