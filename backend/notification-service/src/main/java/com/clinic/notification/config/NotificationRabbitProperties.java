package com.clinic.notification.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.notification.rabbitmq")
public record NotificationRabbitProperties(
        String exchange,
        String queue,
        String routingKey
) {
}
