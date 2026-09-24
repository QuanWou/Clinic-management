package com.clinic.appointment.service;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.UUID;

/** Transaction-scoped PostgreSQL lock serializes ticket allocation across app instances. */
@Component
@RequiredArgsConstructor
public class QueueDayLock {
    private final EntityManager entityManager;

    public void lock(UUID doctorId, LocalDate date) {
        entityManager.createNativeQuery("SELECT pg_advisory_xact_lock(hashtextextended(?1, 0))")
                .setParameter(1, "reception-queue:" + doctorId + ":" + date)
                .getSingleResult();
    }
}