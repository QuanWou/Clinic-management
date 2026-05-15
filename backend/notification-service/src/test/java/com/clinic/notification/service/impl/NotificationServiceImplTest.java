package com.clinic.notification.service.impl;

import com.clinic.common.exception.BusinessException;
import com.clinic.notification.config.NotificationRabbitProperties;
import com.clinic.notification.dto.NotificationRequest;
import com.clinic.notification.dto.NotificationResponse;
import com.clinic.notification.entity.Notification;
import com.clinic.notification.entity.NotificationStatus;
import com.clinic.notification.entity.NotificationType;
import com.clinic.notification.mapper.NotificationMapper;
import com.clinic.notification.provider.NotificationProvider;
import com.clinic.notification.provider.NotificationProviderResolver;
import com.clinic.notification.repository.NotificationRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationServiceImplTest {

    private final NotificationRepository notificationRepository = mock(NotificationRepository.class);
    private final RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
    private final NotificationRabbitProperties rabbitProperties = new NotificationRabbitProperties(
            "notification.exchange",
            "notification.delivery.queue",
            "notification.delivery"
    );
    private final NotificationProviderResolver providerResolver = mock(NotificationProviderResolver.class);
    private final NotificationServiceImpl notificationService = new NotificationServiceImpl(
            notificationRepository,
            new TestNotificationMapper(),
            rabbitTemplate,
            rabbitProperties,
            providerResolver
    );

    @Test
    void sendPersistsPendingNotificationAndPublishesMessage() {
        NotificationRequest request = new NotificationRequest(
                "patient@example.com",
                "Appointment confirmed",
                "Your appointment is confirmed.",
                NotificationType.EMAIL
        );
        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> invocation.getArgument(0));

        NotificationResponse response = notificationService.send(request);

        assertThat(response.id()).isNotNull();
        assertThat(response.recipient()).isEqualTo(request.recipient());
        assertThat(response.subject()).isEqualTo(request.subject());
        assertThat(response.content()).isEqualTo(request.content());
        assertThat(response.type()).isEqualTo(NotificationType.EMAIL);
        assertThat(response.status()).isEqualTo(NotificationStatus.PENDING);
        assertThat(response.sentAt()).isNull();
        verify(notificationRepository).save(any(Notification.class));
        verify(rabbitTemplate).convertAndSend(any(String.class), any(String.class), any(Object.class));
    }

    @Test
    void sendMarksNotificationFailedWhenPublishFails() {
        NotificationRequest request = new NotificationRequest(
                "patient@example.com",
                "Appointment confirmed",
                "Your appointment is confirmed.",
                NotificationType.EMAIL
        );
        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> invocation.getArgument(0));
        doThrow(new RuntimeException("RabbitMQ unavailable"))
                .when(rabbitTemplate).convertAndSend(any(String.class), any(String.class), any(Object.class));

        assertThatThrownBy(() -> notificationService.send(request))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Notification could not be queued");
        ArgumentCaptor<Notification> notificationCaptor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(notificationCaptor.capture());
        assertThat(notificationCaptor.getValue().getStatus()).isEqualTo(NotificationStatus.FAILED);
    }

    @Test
    void deliverMarksNotificationSentWhenProviderSucceeds() {
        UUID id = UUID.randomUUID();
        Notification notification = Notification.builder()
                .id(id)
                .recipient("patient@example.com")
                .subject("Appointment confirmed")
                .content("Your appointment is confirmed.")
                .type(NotificationType.EMAIL)
                .status(NotificationStatus.PENDING)
                .build();
        NotificationProvider provider = mock(NotificationProvider.class);
        when(notificationRepository.findById(id)).thenReturn(Optional.of(notification));
        when(providerResolver.resolve(NotificationType.EMAIL)).thenReturn(provider);

        notificationService.deliver(id);

        assertThat(notification.getStatus()).isEqualTo(NotificationStatus.SENT);
        assertThat(notification.getSentAt()).isNotNull();
        verify(provider).deliver(notification);
    }

    @Test
    void deliverMarksNotificationFailedWhenProviderFails() {
        UUID id = UUID.randomUUID();
        Notification notification = Notification.builder()
                .id(id)
                .recipient("patient@example.com")
                .subject("Appointment confirmed")
                .content("Your appointment is confirmed.")
                .type(NotificationType.EMAIL)
                .status(NotificationStatus.PENDING)
                .build();
        NotificationProvider provider = mock(NotificationProvider.class);
        when(notificationRepository.findById(id)).thenReturn(Optional.of(notification));
        when(providerResolver.resolve(NotificationType.EMAIL)).thenReturn(provider);
        doThrow(new RuntimeException("SMTP unavailable")).when(provider).deliver(notification);

        notificationService.deliver(id);

        assertThat(notification.getStatus()).isEqualTo(NotificationStatus.FAILED);
        assertThat(notification.getSentAt()).isNull();
    }

    @Test
    void getByIdReturnsNotification() {
        UUID id = UUID.randomUUID();
        Notification notification = Notification.builder()
                .id(id)
                .recipient("doctor@example.com")
                .subject("Schedule changed")
                .content("Schedule changed.")
                .type(NotificationType.EMAIL)
                .status(NotificationStatus.SENT)
                .build();
        when(notificationRepository.findById(id)).thenReturn(Optional.of(notification));

        NotificationResponse response = notificationService.getById(id);

        assertThat(response.id()).isEqualTo(id);
        assertThat(response.status()).isEqualTo(NotificationStatus.SENT);
    }

    @Test
    void getByIdThrowsWhenNotificationMissing() {
        UUID id = UUID.randomUUID();
        when(notificationRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> notificationService.getById(id))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Notification not found");
    }

    @Test
    void getAllReturnsMappedNotifications() {
        Notification first = Notification.builder()
                .id(UUID.randomUUID())
                .recipient("one@example.com")
                .subject("First")
                .content("First content")
                .type(NotificationType.EMAIL)
                .status(NotificationStatus.SENT)
                .build();
        Notification second = Notification.builder()
                .id(UUID.randomUUID())
                .recipient("+84901234567")
                .subject("Second")
                .content("Second content")
                .type(NotificationType.SMS)
                .status(NotificationStatus.PENDING)
                .build();
        when(notificationRepository.findAll()).thenReturn(List.of(first, second));

        List<NotificationResponse> responses = notificationService.getAll();

        assertThat(responses).hasSize(2);
        assertThat(responses).extracting(NotificationResponse::status)
                .containsExactly(NotificationStatus.SENT, NotificationStatus.PENDING);
    }

    private static class TestNotificationMapper implements NotificationMapper {
        @Override
        public Notification toEntity(NotificationRequest request) {
            return Notification.builder()
                    .recipient(request.recipient())
                    .subject(request.subject())
                    .content(request.content())
                    .type(request.type())
                    .build();
        }

        @Override
        public NotificationResponse toResponse(Notification notification) {
            return new NotificationResponse(
                    notification.getId(),
                    notification.getRecipient(),
                    notification.getSubject(),
                    notification.getContent(),
                    notification.getType(),
                    notification.getStatus(),
                    notification.getSentAt()
            );
        }
    }
}
