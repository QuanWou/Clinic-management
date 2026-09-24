package com.clinic.billing.repository;

import com.clinic.billing.entity.InvoicePaidOutbox;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface InvoicePaidOutboxRepository extends JpaRepository<InvoicePaidOutbox, UUID> {
    boolean existsByInvoiceId(UUID invoiceId);

    List<InvoicePaidOutbox> findTop50ByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAtAsc(
            String status, LocalDateTime now);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from InvoicePaidOutbox e where e.eventId = :id")
    Optional<InvoicePaidOutbox> findByIdForUpdate(UUID id);
}
