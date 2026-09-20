package com.clinic.notification.provider;

import com.clinic.notification.config.SmsNotificationProperties;
import com.clinic.notification.entity.Notification;
import com.clinic.notification.entity.NotificationType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import java.net.URI;

@Component
@RequiredArgsConstructor
public class SmsNotificationProvider implements NotificationProvider {

    private final RestClient.Builder restClientBuilder;
    private final SmsNotificationProperties properties;

    @Override
    public NotificationType type() {
        return NotificationType.SMS;
    }

    @Override
    public void deliver(Notification notification) {
        if (!properties.enabled() || properties.endpoint() == null || properties.apiKey() == null
                || properties.apiKey().isBlank()) {
            throw new IllegalStateException("SMS provider is not configured");
        }
        URI endpoint = URI.create(properties.endpoint());
        if (!"https".equalsIgnoreCase(endpoint.getScheme()) || endpoint.getHost() == null) {
            throw new IllegalStateException("SMS provider requires an HTTPS endpoint");
        }
        restClientBuilder.build()
                .post()
                .uri(properties.endpoint())
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer " + properties.apiKey())
                .header("Idempotency-Key", notification.getId().toString())
                .body(new SmsRequest(properties.sender(), notification.getRecipient(), notification.getContent()))
                .retrieve()
                .toBodilessEntity();
    }

    private record SmsRequest(String from, String to, String message) {
    }
}
