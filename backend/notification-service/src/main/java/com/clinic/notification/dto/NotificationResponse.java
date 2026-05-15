package com.clinic.notification.dto;

import com.clinic.notification.entity.NotificationStatus;
import com.clinic.notification.entity.NotificationType;
import java.time.Instant;
import java.util.UUID;

public record NotificationResponse(
        UUID id,
        String recipient,
        String subject,
        String content,
        NotificationType type,
        NotificationStatus status,
        Instant sentAt
) {
}
