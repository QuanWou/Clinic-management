package com.clinic.appointment.service;

import com.clinic.appointment.repository.AppointmentNotificationOutboxRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class AppointmentNotificationRelayJob {
    private final AppointmentNotificationOutboxRepository outbox;
    private final AppointmentNotificationPublisher publisher;

    @Scheduled(fixedDelayString = "${app.notification.relay-interval-ms:5000}")
    public void relay() {
        outbox.findTop50ByStatusAndNextAttemptAtLessThanEqualOrderByOccurredAtAsc("PENDING", LocalDateTime.now())
                .forEach(event -> publisher.publish(event.getId()));
    }
}
