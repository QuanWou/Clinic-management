package com.clinic.notification.dto;

import java.util.UUID;

public record NotificationDeliveryMessage(
        UUID notificationId
) {
}
