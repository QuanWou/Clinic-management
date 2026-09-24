package com.clinic.notification.service.impl;

import com.clinic.notification.dto.BusinessNotificationEvent;
import com.clinic.notification.entity.NotificationStatus;
import com.clinic.notification.entity.NotificationType;
import com.clinic.notification.repository.NotificationRepository;
import com.clinic.notification.service.NotificationEventService;
import com.clinic.notification.service.NotificationPreferenceService;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
@RequiredArgsConstructor
public class NotificationEventServiceImpl implements NotificationEventService {
    private final NotificationRepository repository;
    private final NotificationPreferenceService preferenceService;

    @Override
    @Transactional
    public void accept(BusinessNotificationEvent event) {
        if (event == null || event.version() != 1 || event.eventId() == null || event.eventType() == null
                || event.aggregateId() == null || event.recipientUserId() == null || event.channel() == null
                || event.channel() != NotificationType.IN_APP) {
            throw new IllegalArgumentException("Unsupported or incomplete notification event");
        }
        // EMAIL/SMS must not carry an arbitrary destination in a broker payload.
        // Those channels require a future authenticated Identity lookup contract.
        String destination = "in-app";
        // Persist an opt-out tombstone too. A redelivery after a later opt-in must not
        // retrospectively deliver an event that was deliberately suppressed.
        boolean enabled = preferenceService.isEnabled(event.recipientUserId(), event.channel());
        Instant now = Instant.now();
        NotificationStatus status = !enabled ? NotificationStatus.SKIPPED
                : event.channel() == NotificationType.IN_APP ? NotificationStatus.SENT : NotificationStatus.PENDING;
        UUID notificationId = UUID.randomUUID();
        int inserted = repository.insertEventIfAbsent(notificationId, event.recipientUserId(),
                event.eventId(), event.eventType().name(), enabled ? destination : "suppressed",
                event.eventType().subject(), event.eventType().content(), event.channel().name(),
                status.name(), status == NotificationStatus.SENT ? now : null, now);
        if (inserted == 0) {
            log.debug("Duplicate event ignored id={}", event.eventId());
        } else {
            log.info("Business notification recorded eventId={} notificationId={} channel={} status={}",
                    event.eventId(), notificationId, event.channel(), status);
        }
    }

}
