package com.clinic.notification.consumer;

import com.clinic.notification.dto.BusinessNotificationEvent;
import com.clinic.notification.service.NotificationEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class BusinessNotificationConsumer {
    private final NotificationEventService service;

    @RabbitListener(queues = "${app.notification.rabbitmq.event-queue}")
    public void consume(BusinessNotificationEvent event) {
        service.accept(event);
    }
}
