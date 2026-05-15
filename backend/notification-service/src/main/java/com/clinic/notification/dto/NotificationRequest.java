package com.clinic.notification.dto;

import com.clinic.notification.entity.NotificationType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record NotificationRequest(
        @NotBlank @Size(max = 255) String recipient,
        @NotBlank @Size(max = 255) String subject,
        @NotBlank @Size(max = 5000) String content,
        @NotNull NotificationType type
) {
}
