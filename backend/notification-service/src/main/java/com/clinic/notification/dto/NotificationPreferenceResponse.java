package com.clinic.notification.dto;

import com.clinic.notification.entity.NotificationType;

public record NotificationPreferenceResponse(NotificationType type, boolean enabled) {
}
