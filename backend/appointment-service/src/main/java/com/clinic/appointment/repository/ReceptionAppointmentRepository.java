package com.clinic.appointment.repository;

import com.clinic.appointment.entity.Appointment;
import com.clinic.appointment.entity.AppointmentStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReceptionAppointmentRepository extends Repository<Appointment, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Appointment a where a.id = :id")
    Optional<Appointment> lockById(@Param("id") UUID id);

    @Query("select count(a) > 0 from Appointment a where a.doctorId = :doctorId "
            + "and a.appointmentDate = :date and a.startTime < :endTime and a.endTime > :startTime "
            + "and a.status <> :cancelled")
    boolean hasOverlap(@Param("doctorId") UUID doctorId, @Param("date") LocalDate date,
                       @Param("startTime") LocalTime startTime, @Param("endTime") LocalTime endTime,
                       @Param("cancelled") AppointmentStatus cancelled);

    @Query("select count(a) > 0 from Appointment a where a.doctorId = :doctorId "
            + "and a.appointmentDate = :date and a.startTime < :endTime and a.endTime > :startTime "
            + "and a.status <> :cancelled and a.id <> :excludeId")
    boolean hasOverlapExcluding(@Param("doctorId") UUID doctorId, @Param("date") LocalDate date,
                                @Param("startTime") LocalTime startTime, @Param("endTime") LocalTime endTime,
                                @Param("cancelled") AppointmentStatus cancelled, @Param("excludeId") UUID excludeId);

    List<Appointment> findByAppointmentDateOrderByStartTimeAsc(LocalDate appointmentDate);

    List<Appointment> findByDoctorIdAndAppointmentDateOrderByStartTimeAsc(UUID doctorId, LocalDate appointmentDate);
}