package com.clinic.notification.dto;

import com.clinic.notification.entity.NotificationType;

import java.util.UUID;

public record NotificationDeliveryMessage(
        UUID notificationId,
        String recipient,
        String subject,
        String content,
        NotificationType type
) {
}
