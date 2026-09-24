package com.clinic.billing.repository;

import com.clinic.billing.entity.PaymentTransaction;
import com.clinic.billing.entity.PaymentTransactionType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, UUID> {
    Optional<PaymentTransaction> findByExternalReference(String externalReference);

    Optional<PaymentTransaction> findByInvoiceIdAndType(UUID invoiceId, PaymentTransactionType type);

    List<PaymentTransaction> findByInvoiceIdOrderByConfirmedAtAsc(UUID invoiceId);
}