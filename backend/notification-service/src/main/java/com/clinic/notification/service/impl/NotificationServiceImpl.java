package com.clinic.notification.service.impl;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.notification.dto.NotificationRequest;
import com.clinic.notification.dto.NotificationResponse;
import com.clinic.notification.entity.Notification;
import com.clinic.notification.entity.NotificationStatus;
import com.clinic.notification.entity.NotificationType;
import com.clinic.notification.mapper.NotificationMapper;
import com.clinic.notification.provider.NotificationProviderResolver;
import com.clinic.notification.repository.NotificationRepository;
import com.clinic.notification.security.CurrentUserPrincipal;
import com.clinic.notification.service.NotificationService;
import com.clinic.notification.service.NotificationPreferenceService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {
    private static final int MAX_DELIVERY_ATTEMPTS = 3;

    private final NotificationRepository repository;
    private final NotificationMapper mapper;
    private final NotificationProviderResolver providerResolver;
    private final NotificationPreferenceService preferenceService;

    /** The notification row is the durable outbox; the scheduler publishes it after commit. */
    @Override
    @Transactional
    public NotificationResponse send(NotificationRequest request) {
        // The public staff endpoint cannot verify arbitrary email/phone ownership.
        // External delivery is reserved for verified broker producers until an
        // authenticated Identity recipient lookup contract has been implemented.
        if (request.type() != NotificationType.IN_APP) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Manual notifications support IN_APP only; external channels require a verified event producer");
        }
        if (request.recipientUserId() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "recipientUserId is required for delivery");
        }
        if (!preferenceService.isEnabled(request.recipientUserId(), request.type())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Recipient has disabled this notification channel");
        }
        Notification notification = mapper.toEntity(request);
        // Never persist arbitrary staff-entered text that could expose clinical data.
        notification.setSubject("Clinic update");
        notification.setContent("You have a new clinic update. Please sign in to review it securely.");
        notification.setRecipient("in-app");
        notification.setId(UUID.randomUUID());
        notification.setStatus(request.type() == NotificationType.IN_APP ? NotificationStatus.SENT : NotificationStatus.PENDING);
        notification.setNextAttemptAt(Instant.now());
        if (request.type() == NotificationType.IN_APP) {
            notification.setSentAt(Instant.now());
        }
        Notification saved = repository.save(notification);
        log.info("Notification stored id={} type={} status={}", saved.getId(), saved.getType(), saved.getStatus());
        return mapper.toResponse(saved);
    }

    /** A DB row lock serializes redeliveries; the broker message contains only this row's ID. */
    @Override
    @Transactional
    public void deliver(UUID id) {
        Notification notification = repository.findByIdForUpdate(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Notification not found"));
        if (notification.getStatus() != NotificationStatus.PENDING
                || notification.getNextAttemptAt().isAfter(Instant.now())) {
            return;
        }
        if (!preferenceService.isEnabled(notification.getRecipientUserId(), notification.getType())) {
            notification.setStatus(NotificationStatus.SKIPPED);
            notification.setLastEnqueuedAt(null);
            log.info("Notification suppressed by recipient preference id={}", id);
            return;
        }
        try {
            providerResolver.resolve(notification.getType()).deliver(notification);
            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(Instant.now());
            log.info("Notification accepted by provider id={} type={}", id, notification.getType());
        } catch (RuntimeException error) {
            int attempts = notification.getDeliveryAttempts() + 1;
            notification.setDeliveryAttempts(attempts);
            notification.setLastEnqueuedAt(null);
            if (attempts >= MAX_DELIVERY_ATTEMPTS) {
                notification.setStatus(NotificationStatus.FAILED);
            } else {
                notification.setNextAttemptAt(Instant.now().plusSeconds(30L * (1L << (attempts - 1))));
            }
            // Provider exceptions can contain PII, request bodies and credentials: log class only.
            log.warn("Notification delivery attempt failed id={} attempt={} final={} cause={}",
                    id, attempts, notification.getStatus() == NotificationStatus.FAILED,
                    error.getClass().getSimpleName());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public NotificationResponse getById(UUID id, CurrentUserPrincipal principal) {
        Notification notification = repository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Notification not found"));
        // This is a personal detail endpoint, even for users who have a staff role.
        // Staff administration has a separately authorized list endpoint.
        if (notification.getStatus() == NotificationStatus.SKIPPED
                || !principal.id().equals(notification.getRecipientUserId())) {
            throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Notification not found");
        }
        return mapper.toResponse(notification);
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotificationResponse> getAll() {
        return repository.findAll().stream().map(mapper::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotificationResponse> getMine(UUID userId) {
        return repository.findByRecipientUserIdAndStatusNotOrderByCreatedAtDesc(userId, NotificationStatus.SKIPPED).stream()
                .map(mapper::toResponse).toList();
    }

    @Override
    @Transactional
    public NotificationResponse markRead(UUID id, UUID userId) {
        Notification notification = repository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Notification not found"));
        if (!userId.equals(notification.getRecipientUserId())) {
            throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Notification not found");
        }
        if (notification.getStatus() == NotificationStatus.SKIPPED) {
            throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Notification not found");
        }
        if (notification.getReadAt() == null) {
            notification.setReadAt(Instant.now());
        }
        return mapper.toResponse(notification);
    }
}
