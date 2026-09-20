package com.clinic.medicalrecord.repository;

import com.clinic.medicalrecord.entity.MedicalRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MedicalRecordRepository extends JpaRepository<MedicalRecord, UUID> {

    boolean existsByAppointmentId(UUID appointmentId);

    Optional<MedicalRecord> findByAppointmentId(UUID appointmentId);

    List<MedicalRecord> findByPatientIdOrderByCreatedAtDesc(UUID patientId);

    List<MedicalRecord> findByPatientIdAndDoctorIdOrderByCreatedAtDesc(UUID patientId, UUID doctorId);
}
