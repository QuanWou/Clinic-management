package com.clinic.notification.provider;

import com.clinic.notification.entity.Notification;
import com.clinic.notification.entity.NotificationType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
public class EmailNotificationProvider implements NotificationProvider {

    private final JavaMailSender mailSender;
    private final boolean enabled;
    private final String from;

    public EmailNotificationProvider(JavaMailSender mailSender,
                                     @Value("${app.notification.email.enabled:false}") boolean enabled,
                                     @Value("${app.notification.email.from:}") String from) {
        this.mailSender = mailSender;
        this.enabled = enabled;
        this.from = from;
    }

    @Override
    public NotificationType type() {
        return NotificationType.EMAIL;
    }

    @Override
    public void deliver(Notification notification) {
        if (!enabled) {
            throw new IllegalStateException("Email provider is disabled");
        }
        SimpleMailMessage message = new SimpleMailMessage();
        if (!from.isBlank()) {
            message.setFrom(from);
        }
        message.setTo(notification.getRecipient());
        message.setSubject(notification.getSubject());
        message.setText(notification.getContent());
        mailSender.send(message);
    }
}
