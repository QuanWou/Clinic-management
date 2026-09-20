package com.clinic.medicalrecord.repository;

import com.clinic.medicalrecord.entity.LabBillingClosure;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface LabBillingClosureRepository extends JpaRepository<LabBillingClosure, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from LabBillingClosure c where c.appointmentId = :appointmentId")
    Optional<LabBillingClosure> findByAppointmentIdForUpdate(UUID appointmentId);
}
