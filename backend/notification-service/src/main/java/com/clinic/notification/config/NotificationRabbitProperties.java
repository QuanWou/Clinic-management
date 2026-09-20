package com.clinic.notification.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.notification.rabbitmq")
public record NotificationRabbitProperties(
        String exchange,
        String queue,
        String routingKey,
        String eventQueue,
        String eventRoutingKey
) {
    public NotificationRabbitProperties(String exchange, String queue, String routingKey) {
        this(exchange, queue, routingKey, "notification.events.v2.queue", "notification.business");
    }
}
