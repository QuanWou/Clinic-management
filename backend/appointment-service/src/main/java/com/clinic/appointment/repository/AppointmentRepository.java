package com.clinic.appointment.repository;

import com.clinic.appointment.entity.Appointment;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Appointment a where a.id = :id")
    Optional<Appointment> findByIdForUpdate(UUID id);

    List<Appointment> findByPatientIdOrderByAppointmentDateDescStartTimeDesc(UUID patientId);

    List<Appointment> findByDoctorIdAndAppointmentDateOrderByStartTimeAsc(UUID doctorId, LocalDate appointmentDate);

    boolean existsByDoctorIdAndAppointmentDateAndStartTimeLessThanAndEndTimeGreaterThanAndStatusNot(
            UUID doctorId,
            LocalDate appointmentDate,
            LocalTime endTime,
            LocalTime startTime,
            com.clinic.appointment.entity.AppointmentStatus status
    );
}
