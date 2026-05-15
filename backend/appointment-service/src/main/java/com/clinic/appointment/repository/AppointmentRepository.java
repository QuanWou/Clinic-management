package com.clinic.appointment.repository;

import com.clinic.appointment.entity.Appointment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {

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
