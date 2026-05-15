package com.clinic.notification.service;

import com.clinic.notification.dto.NotificationRequest;
import com.clinic.notification.dto.NotificationResponse;

import java.util.List;
import java.util.UUID;

public interface NotificationService {
    NotificationResponse send(NotificationRequest request);
    void deliver(UUID id);
    NotificationResponse getById(UUID id);
    List<NotificationResponse> getAll();
}
