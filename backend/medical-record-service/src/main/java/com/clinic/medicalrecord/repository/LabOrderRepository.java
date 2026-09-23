package com.clinic.medicalrecord.repository;

import com.clinic.medicalrecord.entity.LabOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LabOrderRepository extends JpaRepository<LabOrder, UUID> {
    List<LabOrder> findByMedicalRecordIdOrderByCreatedAtDesc(UUID medicalRecordId);

    boolean existsBySampleIdentifier(String sampleIdentifier);

    boolean existsByMedicalRecordIdAndServiceId(UUID medicalRecordId, UUID serviceId);

    Optional<LabOrder> findByMedicalRecordIdAndIdempotencyKey(UUID medicalRecordId, String idempotencyKey);
}
