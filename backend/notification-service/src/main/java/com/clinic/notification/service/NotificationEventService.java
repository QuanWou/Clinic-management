package com.clinic.notification.service;

import com.clinic.notification.dto.BusinessNotificationEvent;

public interface NotificationEventService {
    void accept(BusinessNotificationEvent event);
}
