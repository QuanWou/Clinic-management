package com.clinic.notification.service.impl;

import com.clinic.notification.dto.BusinessNotificationEvent;
import com.clinic.notification.dto.BusinessNotificationType;
import com.clinic.notification.entity.NotificationType;
import com.clinic.notification.repository.NotificationRepository;
import com.clinic.notification.service.NotificationPreferenceService;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class NotificationEventServiceImplTest {
    private final NotificationRepository repository = mock(NotificationRepository.class);
    private final NotificationPreferenceService preferences = mock(NotificationPreferenceService.class);
    private final NotificationEventServiceImpl service = new NotificationEventServiceImpl(repository, preferences);
    private final UUID eventId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @Test
    void persistsSafeInAppTemplateAndDoesNotStoreClinicalDetails() {
        when(preferences.isEnabled(userId, NotificationType.IN_APP)).thenReturn(true);
        when(repository.insertEventIfAbsent(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(1);
        BusinessNotificationEvent event = event(NotificationType.IN_APP);
        service.accept(event);
        verify(repository).insertEventIfAbsent(any(), eq(userId), eq(eventId),
                eq(BusinessNotificationType.LAB_RESULT_READY.name()), eq("in-app"),
                eq(BusinessNotificationType.LAB_RESULT_READY.subject()),
                argThat(content -> !content.contains("diagnosis") && !content.contains("password")),
                eq("IN_APP"), eq("SENT"), any(), any());
    }

    @Test
    void duplicateEventDoesNotCreateTwoNotifications() {
        when(preferences.isEnabled(userId, NotificationType.IN_APP)).thenReturn(true);
        when(repository.insertEventIfAbsent(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(1, 0);
        service.accept(event(NotificationType.IN_APP));
        service.accept(event(NotificationType.IN_APP));
        verify(repository, times(2)).insertEventIfAbsent(any(), eq(userId), eq(eventId), any(),
                any(), any(), any(), any(), any(), any(), any());
        verify(repository, never()).save(any());
    }

    @Test
    void optedOutRecipientGetsDedupTombstoneWithoutInboxMessage() {
        when(preferences.isEnabled(userId, NotificationType.IN_APP)).thenReturn(false);
        service.accept(event(NotificationType.IN_APP));
        verify(repository).insertEventIfAbsent(any(), eq(userId), eq(eventId), any(), eq("suppressed"),
                any(), any(), eq("IN_APP"), eq("SKIPPED"), isNull(), any());
        verify(repository, never()).save(any());
    }

    @Test
    void invalidContractAndExternalChannelAreRejected() {
        assertThatThrownBy(() -> service.accept(event(NotificationType.SMS)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.accept(event(NotificationType.EMAIL)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.accept(event(NotificationType.PUSH)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.accept(new BusinessNotificationEvent(2, eventId,
                BusinessNotificationType.LAB_RESULT_READY, UUID.randomUUID(), userId,
                NotificationType.IN_APP))).isInstanceOf(IllegalArgumentException.class);
        verify(repository, never()).insertEventIfAbsent(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(repository, never()).save(any());
    }

    private BusinessNotificationEvent event(NotificationType channel) {
        return new BusinessNotificationEvent(1, eventId, BusinessNotificationType.LAB_RESULT_READY,
                UUID.randomUUID(), userId, channel);
    }
}
