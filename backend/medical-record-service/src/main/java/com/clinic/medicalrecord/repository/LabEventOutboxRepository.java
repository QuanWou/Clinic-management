package com.clinic.medicalrecord.repository;

import com.clinic.medicalrecord.entity.LabEventOutbox;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface LabEventOutboxRepository extends JpaRepository<LabEventOutbox, UUID> {
}