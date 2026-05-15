package com.clinic.notification.service.impl;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.notification.config.NotificationRabbitProperties;
import com.clinic.notification.dto.NotificationDeliveryMessage;
import com.clinic.notification.dto.NotificationRequest;
import com.clinic.notification.dto.NotificationResponse;
import com.clinic.notification.entity.Notification;
import com.clinic.notification.entity.NotificationStatus;
import com.clinic.notification.mapper.NotificationMapper;
import com.clinic.notification.provider.NotificationProviderResolver;
import com.clinic.notification.repository.NotificationRepository;
import com.clinic.notification.service.NotificationService;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;
    private final NotificationMapper notificationMapper;
    private final RabbitTemplate rabbitTemplate;
    private final NotificationRabbitProperties rabbitProperties;
    private final NotificationProviderResolver providerResolver;

    @Override
    @Transactional
    public NotificationResponse send(NotificationRequest request) {
        Notification notification = notificationMapper.toEntity(request);
        notification.setId(UUID.randomUUID());
        notification.setStatus(NotificationStatus.PENDING);

        Notification saved = notificationRepository.save(notification);
        NotificationDeliveryMessage message = new NotificationDeliveryMessage(
                saved.getId(),
                saved.getRecipient(),
                saved.getSubject(),
                saved.getContent(),
                saved.getType()
        );
        try {
            rabbitTemplate.convertAndSend(rabbitProperties.exchange(), rabbitProperties.routingKey(), message);
        } catch (RuntimeException e) {
            saved.setStatus(NotificationStatus.FAILED);
            log.error("Notification queue publish failed id={} type={} status={}", saved.getId(), saved.getType(), saved.getStatus(), e);
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "Notification could not be queued");
        }

        log.info("Notification queued id={} type={} status={}", saved.getId(), saved.getType(), saved.getStatus());
        return notificationMapper.toResponse(saved);
    }

    @Override
    @Transactional
    public void deliver(UUID id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Notification not found"));

        try {
            providerResolver.resolve(notification.getType()).deliver(notification);
            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(Instant.now());
            log.info("Notification delivered id={} type={} status={}", notification.getId(), notification.getType(), notification.getStatus());
        } catch (RuntimeException e) {
            notification.setStatus(NotificationStatus.FAILED);
            log.error("Notification delivery failed id={} type={} status={}", notification.getId(), notification.getType(), notification.getStatus(), e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public NotificationResponse getById(UUID id) {
        return notificationRepository.findById(id)
                .map(notificationMapper::toResponse)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Notification not found"));
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotificationResponse> getAll() {
        return notificationRepository.findAll().stream()
                .map(notificationMapper::toResponse)
                .toList();
    }
}
