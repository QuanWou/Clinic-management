package com.clinic.doctor.repository;

import com.clinic.doctor.entity.AdminAudit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AdminAuditRepository extends JpaRepository<AdminAudit, UUID> {
}