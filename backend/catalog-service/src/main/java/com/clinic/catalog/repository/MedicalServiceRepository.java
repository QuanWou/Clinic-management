package com.clinic.catalog.repository;

import com.clinic.catalog.entity.MedicalService;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.List;
import java.util.UUID;

public interface MedicalServiceRepository extends JpaRepository<MedicalService, UUID> {
    List<MedicalService> findByActiveTrue();
    boolean existsByCodeIgnoreCase(String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from MedicalService s where s.id = :id")
    Optional<MedicalService> findLockedById(UUID id);
}