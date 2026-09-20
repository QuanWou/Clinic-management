package com.clinic.notification.repository;

import com.clinic.notification.entity.Notification;
import com.clinic.notification.entity.NotificationStatus;
import com.clinic.notification.entity.NotificationType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {
    List<Notification> findByRecipientUserIdAndStatusNotOrderByCreatedAtDesc(UUID userId, NotificationStatus excluded);

    Optional<Notification> findByEventIdAndRecipientUserIdAndType(UUID eventId, UUID userId, NotificationType type);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select n from Notification n where n.id = :id")
    Optional<Notification> findByIdForUpdate(@Param("id") UUID id);

    // Atomic, concurrency-safe insert: a duplicate redelivery must commit successfully,
    // not leave the listener transaction rollback-only after a unique-constraint error.
    @Modifying
    @Query(value = "INSERT INTO notifications (id, recipient_user_id, event_id, event_type, recipient, "
            + "subject, content, type, status, sent_at, next_attempt_at, created_at, updated_at) "
            + "VALUES (:id, :recipientUserId, :eventId, :eventType, :recipient, :subject, "
            + ":content, :type, :status, :sentAt, :nextAttemptAt, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) "
            + "ON CONFLICT (event_id, recipient_user_id, type) WHERE event_id IS NOT NULL DO NOTHING", nativeQuery = true)
    int insertEventIfAbsent(@Param("id") UUID id,
            @Param("recipientUserId") UUID recipientUserId,
            @Param("eventId") UUID eventId,
            @Param("eventType") String eventType,
            @Param("recipient") String recipient,
            @Param("subject") String subject,
            @Param("content") String content,
            @Param("type") String type,
            @Param("status") String status,
            @Param("sentAt") Instant sentAt,
            @Param("nextAttemptAt") Instant nextAttemptAt);

    @Query("select n.id from Notification n where n.status = :status "
            + "and n.type in :types and n.nextAttemptAt <= :now "
            + "and (n.lastEnqueuedAt is null or n.lastEnqueuedAt <= :stale) order by n.createdAt asc")
    List<UUID> findDispatchableIds(@Param("status") NotificationStatus status,
                                   @Param("types") List<NotificationType> types,
                                   @Param("now") Instant now, @Param("stale") Instant stale,
                                   Pageable page);
}
