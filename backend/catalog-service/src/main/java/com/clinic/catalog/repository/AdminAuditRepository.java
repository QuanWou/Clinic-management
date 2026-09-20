package com.clinic.catalog.repository;

import com.clinic.catalog.entity.AdminAudit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AdminAuditRepository extends JpaRepository<AdminAudit, UUID> {
}