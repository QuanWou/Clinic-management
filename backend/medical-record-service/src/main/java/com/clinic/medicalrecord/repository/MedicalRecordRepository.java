package com.clinic.medicalrecord.repository;

import com.clinic.medicalrecord.entity.MedicalRecord;
import com.clinic.medicalrecord.entity.MedicalRecordStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MedicalRecordRepository extends JpaRepository<MedicalRecord, UUID> {

    boolean existsByAppointmentId(UUID appointmentId);

    Optional<MedicalRecord> findByAppointmentId(UUID appointmentId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from MedicalRecord r where r.id = :id")
    Optional<MedicalRecord> findByIdForUpdate(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from MedicalRecord r where r.appointmentId = :appointmentId")
    Optional<MedicalRecord> findByAppointmentIdForUpdate(@Param("appointmentId") UUID appointmentId);

    List<MedicalRecord> findByPatientIdOrderByCreatedAtDesc(UUID patientId);

    List<MedicalRecord> findByPatientIdAndDoctorIdOrderByCreatedAtDesc(UUID patientId, UUID doctorId);

    List<MedicalRecord> findByPatientIdAndStatusOrderByCreatedAtDesc(UUID patientId, MedicalRecordStatus status);

    List<MedicalRecord> findByPatientIdAndDoctorIdAndStatusOrderByCreatedAtDesc(
            UUID patientId, UUID doctorId, MedicalRecordStatus status);

    /** Database-level ownership filter with a bounded result. */
    Page<MedicalRecord> findByDoctorId(UUID doctorId, Pageable pageable);

    Page<MedicalRecord> findByDoctorIdAndStatus(UUID doctorId, MedicalRecordStatus status, Pageable pageable);
}