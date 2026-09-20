package com.clinic.billing.repository;

import com.clinic.billing.entity.InvoicePaidOutbox;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface InvoicePaidOutboxRepository extends JpaRepository<InvoicePaidOutbox, UUID> {
    boolean existsByInvoiceId(UUID invoiceId);
}