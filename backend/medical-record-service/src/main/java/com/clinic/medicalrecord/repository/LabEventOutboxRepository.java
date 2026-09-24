package com.clinic.medicalrecord.repository;

import com.clinic.medicalrecord.entity.LabEventOutbox;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface LabEventOutboxRepository extends JpaRepository<LabEventOutbox, UUID> {
    List<LabEventOutbox> findTop50ByStatusAndNextAttemptAtLessThanEqualOrderByOccurredAtAsc(
            String status, LocalDateTime now);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from LabEventOutbox e where e.id = :id")
    Optional<LabEventOutbox> findByIdForUpdate(UUID id);
}
