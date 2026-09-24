package com.clinic.notification.mapper;

import com.clinic.notification.dto.NotificationRequest;
import com.clinic.notification.dto.NotificationResponse;
import com.clinic.notification.entity.Notification;
import com.clinic.notification.dto.BusinessNotificationType;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface NotificationMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "sentAt", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "eventId", ignore = true)
    @Mapping(target = "eventType", ignore = true)
    @Mapping(target = "readAt", ignore = true)
    @Mapping(target = "deliveryAttempts", ignore = true)
    @Mapping(target = "publishFailures", ignore = true)
    @Mapping(target = "nextAttemptAt", ignore = true)
    @Mapping(target = "lastEnqueuedAt", ignore = true)
    Notification toEntity(NotificationRequest request);

    @Mapping(target = "subject", expression = "java(safeSubject(notification))")
    @Mapping(target = "content", expression = "java(safeContent(notification))")
    NotificationResponse toResponse(Notification notification);

    default String safeSubject(Notification notification) {
        if (notification.getEventType() != null) {
            try {
                return BusinessNotificationType.valueOf(notification.getEventType()).subject();
            } catch (IllegalArgumentException ignored) {
                // Legacy/unknown event type: do not return untrusted historical content.
            }
        }
        return "Clinic update";
    }

    default String safeContent(Notification notification) {
        if (notification.getEventType() != null) {
            try {
                return BusinessNotificationType.valueOf(notification.getEventType()).content();
            } catch (IllegalArgumentException ignored) {
                // Legacy/unknown event type: do not return untrusted historical content.
            }
        }
        return "You have a clinic update. Please sign in to review it securely.";
    }
}
