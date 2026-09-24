package com.clinic.appointment.repository;

import com.clinic.appointment.entity.ReceptionVisit;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReceptionVisitRepository extends JpaRepository<ReceptionVisit, UUID> {

    Optional<ReceptionVisit> findByAppointmentId(UUID appointmentId);

    @Query("select coalesce(max(v.queueNumber), 0) from ReceptionVisit v "
            + "where v.doctorId = :doctorId and v.visitDate = :date")
    int lastQueueNumber(@Param("doctorId") UUID doctorId, @Param("date") LocalDate date);

    List<ReceptionVisit> findByDoctorIdAndVisitDateOrderByQueueNumberAsc(UUID doctorId, LocalDate visitDate);

    List<ReceptionVisit> findByVisitDateOrderByDoctorIdAscQueueNumberAsc(LocalDate visitDate);

    List<ReceptionVisit> findByVisitDateBetweenOrderByVisitDateAscQueueNumberAsc(LocalDate from, LocalDate to);

    List<ReceptionVisit> findByDoctorIdAndVisitDateBetweenOrderByVisitDateAscQueueNumberAsc(
            UUID doctorId, LocalDate from, LocalDate to);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from ReceptionVisit v where v.id = :id")
    Optional<ReceptionVisit> lockById(@Param("id") UUID id);
}