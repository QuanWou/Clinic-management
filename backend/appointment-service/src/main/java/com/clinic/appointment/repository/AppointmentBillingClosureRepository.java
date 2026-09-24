package com.clinic.appointment.repository;

import com.clinic.appointment.entity.AppointmentBillingClosure;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface AppointmentBillingClosureRepository extends JpaRepository<AppointmentBillingClosure, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from AppointmentBillingClosure c where c.appointmentId = :appointmentId")
    Optional<AppointmentBillingClosure> findByAppointmentIdForUpdate(UUID appointmentId);
}
