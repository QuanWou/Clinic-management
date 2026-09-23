package com.clinic.medicalrecord.repository;

import com.clinic.medicalrecord.entity.Prescription;
import com.clinic.medicalrecord.entity.PrescriptionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PrescriptionRepository extends JpaRepository<Prescription, UUID> {
    List<Prescription> findByMedicalRecordIdOrderByCreatedAtDesc(UUID medicalRecordId);

    Optional<Prescription> findFirstByMedicalRecordIdAndStatusOrderByCreatedAtDesc(
            UUID medicalRecordId, PrescriptionStatus status);

    boolean existsByMedicalRecordIdAndStatus(UUID medicalRecordId, PrescriptionStatus status);
}
