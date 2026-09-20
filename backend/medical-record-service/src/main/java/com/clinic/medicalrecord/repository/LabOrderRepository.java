package com.clinic.medicalrecord.repository;

import com.clinic.medicalrecord.entity.LabOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LabOrderRepository extends JpaRepository<LabOrder, UUID> {
    List<LabOrder> findByMedicalRecordIdOrderByCreatedAtDesc(UUID medicalRecordId);

    boolean existsBySampleIdentifier(String sampleIdentifier);
}