package com.clinic.notification.service.impl;

import com.clinic.notification.entity.NotificationType;
import com.clinic.notification.entity.NotificationStatus;
import com.clinic.notification.repository.NotificationRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Slf4j
@RequiredArgsConstructor
public class NotificationDispatchJob {
    private final NotificationRepository repository;
    private final NotificationOutboxPublisher publisher;

    @Scheduled(fixedDelayString = "${app.notification.dispatch-interval-ms:10000}")
    public void dispatchPending() {
        Instant now = Instant.now();
        List<UUID> ids = repository.findDispatchableIds(NotificationStatus.PENDING,
                List.of(NotificationType.EMAIL, NotificationType.SMS),
                now, now.minusSeconds(60), PageRequest.of(0, 50));
        for (UUID id : ids) {
            try {
                publisher.publishOne(id);
            } catch (RuntimeException error) {
                log.warn("Notification dispatch encountered persistence failure id={} cause={}",
                        id, error.getClass().getSimpleName());
            }
        }
    }
}
