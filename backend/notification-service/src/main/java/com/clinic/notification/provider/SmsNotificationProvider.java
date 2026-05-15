package com.clinic.notification.provider;

import com.clinic.notification.config.SmsNotificationProperties;
import com.clinic.notification.entity.Notification;
import com.clinic.notification.entity.NotificationType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

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
        restClientBuilder.build()
                .post()
                .uri(properties.endpoint())
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer " + properties.apiKey())
                .body(new SmsRequest(properties.sender(), notification.getRecipient(), notification.getContent()))
                .retrieve()
                .toBodilessEntity();
    }

    private record SmsRequest(String from, String to, String message) {
    }
}
