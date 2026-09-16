package com.clinic.notification.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.notification.sms")
public record SmsNotificationProperties(
        String endpoint,
        String apiKey,
        String sender
) {
}
