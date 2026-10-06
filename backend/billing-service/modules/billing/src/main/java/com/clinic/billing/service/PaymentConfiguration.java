package com.clinic.billing.service;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import java.util.UUID;

@Configuration
@EnableConfigurationProperties(PaymentConfiguration.Settings.class)
public class PaymentConfiguration {
 @ConfigurationProperties("billing.payments")
 public record Settings(boolean enabled,UUID clinicId,String publicUrl,Payos payos,Vnpay vnpay,Bank bank) {}
 public record Payos(String clientId,String apiKey,String checksumKey,String baseUrl) {}
 public record Vnpay(String tmnCode,String hashSecret,String url) {}
 public record Bank(String bankCode,String bankName,String accountNumber,String accountName) {}
}
