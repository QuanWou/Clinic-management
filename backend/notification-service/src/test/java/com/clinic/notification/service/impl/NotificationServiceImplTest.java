package com.clinic.notification.service.impl;

import com.clinic.common.exception.BusinessException;
import com.clinic.notification.dto.NotificationRequest;
import com.clinic.notification.dto.NotificationResponse;
import com.clinic.notification.entity.Notification;
import com.clinic.notification.entity.NotificationStatus;
import com.clinic.notification.entity.NotificationType;
import com.clinic.notification.mapper.NotificationMapper;
import com.clinic.notification.provider.NotificationProvider;
import com.clinic.notification.provider.NotificationProviderResolver;
import com.clinic.notification.repository.NotificationRepository;
import com.clinic.notification.security.CurrentUserPrincipal;
import com.clinic.notification.service.NotificationPreferenceService;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class NotificationServiceImplTest {
    private final NotificationRepository repository = mock(NotificationRepository.class);
    private final NotificationProviderResolver resolver = mock(NotificationProviderResolver.class);
    private final NotificationPreferenceService preferences = mock(NotificationPreferenceService.class);
    private final NotificationServiceImpl service = new NotificationServiceImpl(repository,
            new TestMapper(), resolver, preferences);
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setup() {
        when(preferences.isEnabled(any(UUID.class), any(NotificationType.class))).thenReturn(true);
        when(repository.save(any(Notification.class))).thenAnswer(call -> call.getArgument(0));
    }

    @Test
    void sendManualCreatesOnlyInAppWithoutPublishing() {
        NotificationResponse response = service.send(new NotificationRequest("in-app", "Visit",
                "Your visit", NotificationType.IN_APP, userId));
        assertThat(response.status()).isEqualTo(NotificationStatus.SENT);
        assertThat(response.recipientUserId()).isEqualTo(userId);
        assertThat(response.id()).isNotNull();
        verify(repository).save(argThat(n -> n.getNextAttemptAt() != null && n.getLastEnqueuedAt() == null
                && n.getRecipient().equals("in-app")));
    }

    @Test
    void inAppMessageIsImmediatelyAvailableWithoutProvider() {
        NotificationResponse response = service.send(new NotificationRequest("in-app", "Visit", "Update",
                NotificationType.IN_APP, userId));
        assertThat(response.status()).isEqualTo(NotificationStatus.SENT);
        assertThat(response.sentAt()).isNotNull();
        assertThat(response.subject()).isEqualTo("Clinic update");
        assertThat(response.content()).doesNotContain("Update");
        verifyNoInteractions(resolver);
    }

    @Test
    void sendRejectsMissingOwnerUnsupportedPushAndDisabledChannel() {
        assertThatThrownBy(() -> service.send(new NotificationRequest("x@y.com", "Subject", "Message",
                NotificationType.EMAIL))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.send(new NotificationRequest("in-app", "Subject", "Message",
                NotificationType.PUSH, userId))).isInstanceOf(BusinessException.class);
        when(preferences.isEnabled(userId, NotificationType.SMS)).thenReturn(false);
        assertThatThrownBy(() -> service.send(new NotificationRequest("+84901234567", "Subject", "Message",
                NotificationType.SMS, userId))).isInstanceOf(BusinessException.class);
        verify(repository, never()).save(any());
    }

    @Test
    void manualStaffRequestCannotSendExternalEmailOrSmsEvenWithOptIn() {
        assertThatThrownBy(() -> service.send(new NotificationRequest("wrong@example.com", "Subject", "Message",
                NotificationType.EMAIL, userId))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.send(new NotificationRequest("+84901234567", "Subject", "Message",
                NotificationType.SMS, userId))).isInstanceOf(BusinessException.class);
        verify(repository, never()).save(any());
    }

    @Test
    void deliverOnceEvenWhenRabbitMessageRedelivered() {
        Notification notification = pending();
        NotificationProvider provider = mock(NotificationProvider.class);
        when(repository.findByIdForUpdate(notification.getId())).thenReturn(Optional.of(notification));
        when(resolver.resolve(NotificationType.EMAIL)).thenReturn(provider);
        service.deliver(notification.getId());
        service.deliver(notification.getId());
        assertThat(notification.getStatus()).isEqualTo(NotificationStatus.SENT);
        assertThat(notification.getSentAt()).isNotNull();
        verify(provider, times(1)).deliver(notification);
    }

    @Test
    void providerFailuresBackOffThenStopAfterThreeAttempts() {
        Notification notification = pending();
        NotificationProvider provider = mock(NotificationProvider.class);
        when(repository.findByIdForUpdate(notification.getId())).thenReturn(Optional.of(notification));
        when(resolver.resolve(NotificationType.EMAIL)).thenReturn(provider);
        doThrow(new IllegalStateException("Provider unavailable")).when(provider).deliver(notification);
        service.deliver(notification.getId());
        assertThat(notification.getStatus()).isEqualTo(NotificationStatus.PENDING);
        assertThat(notification.getDeliveryAttempts()).isEqualTo(1);
        verify(provider, times(1)).deliver(notification);
        // A premature queue redelivery cannot bypass the backoff.
        service.deliver(notification.getId());
        verify(provider, times(1)).deliver(notification);
        notification.setNextAttemptAt(Instant.now().minusSeconds(1));
        service.deliver(notification.getId());
        notification.setNextAttemptAt(Instant.now().minusSeconds(1));
        service.deliver(notification.getId());
        assertThat(notification.getStatus()).isEqualTo(NotificationStatus.FAILED);
        assertThat(notification.getDeliveryAttempts()).isEqualTo(3);
        service.deliver(notification.getId());
        verify(provider, times(3)).deliver(notification);
    }

    @Test
    void optedOutBeforeProviderSendIsSkippedEvenAfterQueueing() {
        Notification notification = pending();
        when(repository.findByIdForUpdate(notification.getId())).thenReturn(Optional.of(notification));
        when(preferences.isEnabled(userId, NotificationType.EMAIL)).thenReturn(false);
        service.deliver(notification.getId());
        assertThat(notification.getStatus()).isEqualTo(NotificationStatus.SKIPPED);
        verifyNoInteractions(resolver);
    }

    @Test
    void recipientCanReadOwnNotificationButCannotReadAnotherUsersNotification() {
        Notification notification = pending();
        when(repository.findById(notification.getId())).thenReturn(Optional.of(notification));
        CurrentUserPrincipal owner = principal(userId, "ROLE_PATIENT");
        assertThat(service.getById(notification.getId(), owner).id()).isEqualTo(notification.getId());
        assertThatThrownBy(() -> service.getById(notification.getId(), principal(UUID.randomUUID(), "ROLE_PATIENT")))
                .isInstanceOf(BusinessException.class).hasMessage("Notification not found");
        assertThat(service.getById(notification.getId(), principal(UUID.randomUUID(), "ROLE_ADMIN")).id())
                .isEqualTo(notification.getId());
    }

    @Test
    void mineAndMarkReadAreScopedToJwtUserId() {
        Notification notification = pending();
        when(repository.findByRecipientUserIdAndStatusNotOrderByCreatedAtDesc(userId, NotificationStatus.SKIPPED))
                .thenReturn(List.of(notification));
        when(repository.findById(notification.getId())).thenReturn(Optional.of(notification));
        assertThat(service.getMine(userId)).hasSize(1);
        verify(repository).findByRecipientUserIdAndStatusNotOrderByCreatedAtDesc(userId, NotificationStatus.SKIPPED);
        assertThatThrownBy(() -> service.markRead(notification.getId(), UUID.randomUUID()))
                .isInstanceOf(BusinessException.class);
        service.markRead(notification.getId(), userId);
        Instant firstRead = notification.getReadAt();
        service.markRead(notification.getId(), userId);
        assertThat(notification.getReadAt()).isEqualTo(firstRead);
    }

    private Notification pending() {
        return Notification.builder().id(UUID.randomUUID()).recipientUserId(userId)
                .recipient("patient@example.com").subject("Visit").content("Appointment update")
                .type(NotificationType.EMAIL).status(NotificationStatus.PENDING)
                .nextAttemptAt(Instant.now().minusSeconds(1)).build();
    }

    private CurrentUserPrincipal principal(UUID id, String authority) {
        return new CurrentUserPrincipal(id, "user@example.com", List.of(new SimpleGrantedAuthority(authority)));
    }

    private static class TestMapper implements NotificationMapper {
        @Override
        public Notification toEntity(NotificationRequest request) {
            return Notification.builder().recipient(request.recipient()).subject(request.subject())
                    .content(request.content()).type(request.type()).recipientUserId(request.recipientUserId()).build();
        }

        @Override
        public NotificationResponse toResponse(Notification n) {
            return new NotificationResponse(n.getId(), n.getRecipient(), n.getSubject(), n.getContent(),
                    n.getType(), n.getStatus(), n.getSentAt(), n.getRecipientUserId(), n.getReadAt(), n.getCreatedAt());
        }
    }
}
