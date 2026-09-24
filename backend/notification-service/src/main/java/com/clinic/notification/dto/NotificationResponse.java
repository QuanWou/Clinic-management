package com.clinic.notification.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.clinic.notification.entity.NotificationStatus;
import com.clinic.notification.entity.NotificationType;
import java.time.Instant;
import java.util.UUID;

public record NotificationResponse(
        UUID id,
        @JsonIgnore String recipient,
        String subject,
        String content,
        NotificationType type,
        NotificationStatus status,
        Instant sentAt,
        @JsonIgnore UUID recipientUserId,
        Instant readAt,
        Instant createdAt
) {
}
