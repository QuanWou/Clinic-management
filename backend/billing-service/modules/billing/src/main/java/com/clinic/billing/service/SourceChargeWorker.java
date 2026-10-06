package com.clinic.billing.service;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;
@Configuration @EnableScheduling @ConditionalOnProperty(name="billing.charges.enabled",havingValue="true")
public class SourceChargeWorker{
 private final SourceChargeService service;public SourceChargeWorker(SourceChargeService service){this.service=service;}
 @Scheduled(fixedDelayString="${billing.charges.delay-ms:1000}")public void run(){service.deliverBatch();}
}
