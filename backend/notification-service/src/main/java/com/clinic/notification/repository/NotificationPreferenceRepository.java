package com.clinic.notification.repository;

import com.clinic.notification.entity.NotificationPreference;
import com.clinic.notification.entity.NotificationType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, UUID> {
    Optional<NotificationPreference> findByUserIdAndType(UUID userId, NotificationType type);
    List<NotificationPreference> findByUserId(UUID userId);
}
