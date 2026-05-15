package com.clinic.gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "services")
public record ServicesProperties(
        String identityUrl,
        String appointmentUrl,
        String medicalRecordUrl,
        String billingUrl
) {
}
