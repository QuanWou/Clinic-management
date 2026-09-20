package com.clinic.notification.dto;

import com.clinic.notification.entity.NotificationType;
import java.util.UUID;

/** Version 1: broker-safe envelope. Never transmit email, phone or clinical content. */
public record BusinessNotificationEvent(
        int version,
        UUID eventId,
        BusinessNotificationType eventType,
        UUID aggregateId,
        UUID recipientUserId,
        NotificationType channel
) {
}
