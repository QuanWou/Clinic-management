package com.clinic.billing.repository;

import com.clinic.billing.entity.InvoiceItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface InvoiceItemRepository extends JpaRepository<InvoiceItem, UUID> {
    List<InvoiceItem> findByInvoiceIdOrderBySourceTypeAscSourceIdAsc(UUID invoiceId);
}