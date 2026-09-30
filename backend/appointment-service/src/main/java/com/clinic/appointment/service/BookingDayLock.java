package com.clinic.appointment.service;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.UUID;

/** Staff booking lock. The shared booking constraint must be supplied by task 01 at integration. */
@Component
@RequiredArgsConstructor
public class BookingDayLock {
    private final EntityManager entityManager;

    public void lock(UUID doctorId, LocalDate date) {
        entityManager.createNativeQuery("SELECT pg_advisory_xact_lock(hashtextextended(?1, 0))")
                .setParameter(1, "reception-booking:" + doctorId + ":" + date)
                .getSingleResult();
    }
}