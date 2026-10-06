package com.clinic.identity.repository;

import com.clinic.identity.entity.AdminAudit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AdminAuditRepository extends JpaRepository<AdminAudit, UUID> {
}