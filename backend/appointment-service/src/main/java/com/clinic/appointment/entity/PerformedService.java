package com.clinic.appointment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "performed_services")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PerformedService {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "appointment_id", nullable = false)
    private UUID appointmentId;

    @Column(name = "service_id", nullable = false)
    private UUID serviceId;

    @Column(name = "quantity", nullable = false)
    private int quantity;

    @Column(name = "service_date", nullable = false)
    private LocalDate serviceDate;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
