package com.clinic.billing.service;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;
@Configuration @EnableScheduling @ConditionalOnProperty(name="billing.notification.enabled",havingValue="true")
public class BillingNotificationRelay{
 private final BillingNotificationDelivery delivery;public BillingNotificationRelay(BillingNotificationDelivery delivery){this.delivery=delivery;}
 @Scheduled(fixedDelayString="${billing.notification.delay-ms:1000}")public void run(){delivery.deliverBatch();}
}
