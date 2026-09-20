package com.clinic.catalog.repository;

import com.clinic.catalog.entity.Medicine;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;
import java.util.List;

public interface MedicineRepository extends JpaRepository<Medicine, UUID> {
    List<Medicine> findByActiveTrue();
    boolean existsByCodeIgnoreCase(String code);
}