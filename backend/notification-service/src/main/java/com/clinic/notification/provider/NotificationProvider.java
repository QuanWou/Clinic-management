package com.clinic.notification.provider;

import com.clinic.notification.entity.Notification;
import com.clinic.notification.entity.NotificationType;

public interface NotificationProvider {
    NotificationType type();

    void deliver(Notification notification);
}
