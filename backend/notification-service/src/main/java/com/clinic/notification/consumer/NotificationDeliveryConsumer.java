package com.clinic.notification.consumer;

import com.clinic.notification.dto.NotificationDeliveryMessage;
import com.clinic.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
@Slf4j
@RequiredArgsConstructor
public class NotificationDeliveryConsumer {

    private final NotificationService notificationService;

    @RabbitListener(queues = "${app.notification.rabbitmq.queue}")
    public void consume(NotificationDeliveryMessage message) {
        log.info("Received notification delivery message id={} type={}", message.notificationId(), message.type());
        notificationService.deliver(message.notificationId());
    }
}
