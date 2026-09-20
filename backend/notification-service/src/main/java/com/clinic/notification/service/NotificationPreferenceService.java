package com.clinic.notification.service;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.notification.dto.NotificationPreferenceResponse;
import com.clinic.notification.entity.NotificationPreference;
import com.clinic.notification.entity.NotificationType;
import com.clinic.notification.repository.NotificationPreferenceRepository;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NotificationPreferenceService {
    private final NotificationPreferenceRepository repository;

    /** External delivery is opt-in; inbox is on by default. PUSH cannot be enabled without a provider. */
    @Transactional(readOnly = true)
    public boolean isEnabled(UUID userId, NotificationType type) {
        if (type == NotificationType.PUSH) {
            return false;
        }
        return repository.findByUserIdAndType(userId, type)
                .map(NotificationPreference::isEnabled)
                .orElse(type == NotificationType.IN_APP);
    }

    @Transactional(readOnly = true)
    public List<NotificationPreferenceResponse> mine(UUID userId) {
        return Arrays.stream(NotificationType.values())
                .map(type -> new NotificationPreferenceResponse(type, isEnabled(userId, type)))
                .toList();
    }

    @Transactional
    public NotificationPreferenceResponse update(UUID userId, NotificationType type, boolean enabled) {
        if (type == NotificationType.PUSH) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Push provider is not configured");
        }
        NotificationPreference preference = repository.findByUserIdAndType(userId, type)
                .orElseGet(() -> {
                    NotificationPreference created = new NotificationPreference();
                    created.setId(UUID.randomUUID());
                    created.setUserId(userId);
                    created.setType(type);
                    return created;
                });
        preference.setEnabled(enabled);
        repository.save(preference);
        return new NotificationPreferenceResponse(type, enabled);
    }
}
