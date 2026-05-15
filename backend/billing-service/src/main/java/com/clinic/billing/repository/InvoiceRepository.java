package com.clinic.billing.repository;

import com.clinic.billing.entity.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {

    boolean existsByAppointmentId(UUID appointmentId);

    Optional<Invoice> findByAppointmentId(UUID appointmentId);

    List<Invoice> findByPatientIdOrderByCreatedAtDesc(UUID patientId);
}
