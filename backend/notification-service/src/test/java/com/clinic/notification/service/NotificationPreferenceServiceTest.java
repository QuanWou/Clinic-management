package com.clinic.notification.service;

import com.clinic.common.exception.BusinessException;
import com.clinic.notification.dto.NotificationPreferenceResponse;
import com.clinic.notification.entity.NotificationPreference;
import com.clinic.notification.entity.NotificationType;
import com.clinic.notification.repository.NotificationPreferenceRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class NotificationPreferenceServiceTest {
    private final NotificationPreferenceRepository repository = mock(NotificationPreferenceRepository.class);
    private final NotificationPreferenceService service = new NotificationPreferenceService(repository);
    private final UUID user = UUID.randomUUID();

    @Test
    void externalChannelsDefaultOffButInboxDefaultsOn() {
        assertThat(service.isEnabled(user, NotificationType.EMAIL)).isFalse();
        assertThat(service.isEnabled(user, NotificationType.SMS)).isFalse();
        assertThat(service.isEnabled(user, NotificationType.IN_APP)).isTrue();
        assertThat(service.mine(user)).contains(
                new NotificationPreferenceResponse(NotificationType.EMAIL, false),
                new NotificationPreferenceResponse(NotificationType.SMS, false),
                new NotificationPreferenceResponse(NotificationType.PUSH, false));
    }

    @Test
    void unsupportedPushNeverAdvertisedEvenIfOldDatabaseRowWasEnabled() {
        NotificationPreference legacy = new NotificationPreference();
        legacy.setType(NotificationType.PUSH);
        legacy.setEnabled(true);
        when(repository.findByUserIdAndType(user, NotificationType.PUSH)).thenReturn(Optional.of(legacy));
        assertThat(service.isEnabled(user, NotificationType.PUSH)).isFalse();
        assertThatThrownBy(() -> service.update(user, NotificationType.PUSH, true))
                .isInstanceOf(BusinessException.class);
        verify(repository, never()).save(any());
    }

    @Test
    void updatesOnlyJwtAccountPreferenceAndRespectsOptOut() {
        when(repository.save(any(NotificationPreference.class))).thenAnswer(call -> call.getArgument(0));
        NotificationPreferenceResponse result = service.update(user, NotificationType.IN_APP, false);
        assertThat(result.enabled()).isFalse();
        verify(repository).save(argThat(row -> row.getUserId().equals(user) && !row.isEnabled()
                && row.getType() == NotificationType.IN_APP));
    }
}
