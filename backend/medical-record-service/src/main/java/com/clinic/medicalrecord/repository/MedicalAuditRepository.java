package com.clinic.medicalrecord.repository;

import com.clinic.medicalrecord.entity.MedicalAuditEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MedicalAuditRepository extends JpaRepository<MedicalAuditEvent, UUID> {
}