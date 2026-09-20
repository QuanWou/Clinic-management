package com.clinic.appointment.repository;

import com.clinic.appointment.entity.PerformedService;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PerformedServiceRepository extends JpaRepository<PerformedService, UUID> {
    List<PerformedService> findByAppointmentIdOrderByCreatedAtAsc(UUID appointmentId);
}
