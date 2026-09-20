package com.clinic.notification.config;

import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.Queue;

import static org.assertj.core.api.Assertions.assertThat;

class RabbitMqConfigTest {
    private final RabbitMqConfig config = new RabbitMqConfig();
    private final NotificationRabbitProperties properties = new NotificationRabbitProperties(
            "notification.exchange", "notification.delivery.v2.queue", "notification.delivery.v2",
            "notification.events.v2.queue", "notification.business");

    @Test
    void newDeliveryQueueHasSeparateDeadLetterRoute() {
        Queue live = config.notificationQueue(properties);
        Queue dead = config.notificationDeadQueue(properties);
        Binding deadBinding = config.notificationDeadBinding(dead, config.notificationDeadExchange(properties), properties);
        assertThat(live.getName()).isEqualTo("notification.delivery.v2.queue");
        assertThat(live.getArguments()).containsEntry("x-dead-letter-exchange", "notification.exchange.dead")
                .containsEntry("x-dead-letter-routing-key", "notification.delivery.v2.dead");
        assertThat(dead.getName()).isEqualTo("notification.delivery.v2.queue.dead");
        assertThat(deadBinding.getRoutingKey()).isEqualTo("notification.delivery.v2.dead");
    }

    @Test
    void businessEventsUseTheirOwnDeadLetterQueue() {
        Queue queue = config.notificationEventsQueue(properties);
        Queue dead = config.notificationEventDeadQueue(properties);
        Binding binding = config.notificationEventDeadBinding(dead, config.notificationDeadExchange(properties), properties);
        assertThat(queue.getArguments()).containsEntry("x-dead-letter-routing-key", "notification.business.dead");
        assertThat(dead.getName()).isEqualTo("notification.events.v2.queue.dead");
        assertThat(binding.getRoutingKey()).isEqualTo("notification.business.dead");
    }
}
