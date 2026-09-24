package com.clinic.notification.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.notification.sms")
public record SmsNotificationProperties(
        boolean enabled,
        String endpoint,
        String apiKey,
        String sender
) {
}
