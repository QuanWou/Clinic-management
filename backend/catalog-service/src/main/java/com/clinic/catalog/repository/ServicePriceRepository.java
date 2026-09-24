package com.clinic.catalog.repository;

import com.clinic.catalog.entity.ServicePrice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ServicePriceRepository extends JpaRepository<ServicePrice, UUID> {
    List<ServicePrice> findByServiceIdOrderByEffectiveFromDesc(UUID serviceId);
}