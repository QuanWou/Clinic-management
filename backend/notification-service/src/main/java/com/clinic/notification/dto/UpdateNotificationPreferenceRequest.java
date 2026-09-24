package com.clinic.notification.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateNotificationPreferenceRequest(@NotNull Boolean enabled) {
}
