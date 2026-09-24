package com.clinic.notification.provider;

import com.clinic.notification.config.SmsNotificationProperties;
import com.clinic.notification.entity.Notification;
import com.clinic.notification.entity.NotificationStatus;
import com.clinic.notification.entity.NotificationType;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class NotificationProviderSafetyTest {
    private final Notification notification = Notification.builder().recipient("patient@example.test")
            .subject("Visit").content("Visit update").type(NotificationType.EMAIL)
            .status(NotificationStatus.PENDING).build();

    @Test
    void disabledEmailNeverCallsSmtp() {
        JavaMailSender mail = mock(JavaMailSender.class);
        assertThatThrownBy(() -> new EmailNotificationProvider(mail, false, "clinic@example.test").deliver(notification))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(mail);
    }

    @Test
    void disabledOrUnconfiguredSmsNeverCallsHttpProvider() {
        RestClient.Builder builder = mock(RestClient.Builder.class);
        SmsNotificationProvider disabled = new SmsNotificationProvider(builder,
                new SmsNotificationProperties(false, "https://sms.example.test/messages", "a-key", "Clinic"));
        SmsNotificationProvider incomplete = new SmsNotificationProvider(builder,
                new SmsNotificationProperties(true, "https://sms.example.test/messages", "", "Clinic"));
        SmsNotificationProvider insecure = new SmsNotificationProvider(builder,
                new SmsNotificationProperties(true, "http://sms.example.test/messages", "a-key", "Clinic"));
        assertThatThrownBy(() -> disabled.deliver(notification)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> incomplete.deliver(notification)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> insecure.deliver(notification)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(builder);
    }
}
