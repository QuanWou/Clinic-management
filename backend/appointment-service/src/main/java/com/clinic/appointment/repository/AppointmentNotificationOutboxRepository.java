package com.clinic.appointment.repository;

import com.clinic.appointment.entity.AppointmentNotificationOutbox;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AppointmentNotificationOutboxRepository extends JpaRepository<AppointmentNotificationOutbox, UUID> {
    List<AppointmentNotificationOutbox> findTop50ByStatusAndNextAttemptAtLessThanEqualOrderByOccurredAtAsc(
            String status, LocalDateTime now);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from AppointmentNotificationOutbox e where e.id = :id")
    Optional<AppointmentNotificationOutbox> findByIdForUpdate(UUID id);
}
