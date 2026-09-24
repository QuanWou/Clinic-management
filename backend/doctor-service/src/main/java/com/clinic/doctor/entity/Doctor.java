package com.clinic.doctor.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "doctors")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Doctor {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Public doctor profile code; userId links only to the Identity service. */
    @Generated(event = EventType.INSERT)
    @Column(name = "doctor_code", nullable = false, unique = true, length = 24, insertable = false, updatable = false)
    private String doctorCode;

    @Column(name = "user_id", nullable = false, unique = true)
    private UUID userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "specialty_id", nullable = false)
    private Specialty specialty;

    @Column(columnDefinition = "TEXT")
    private String biography;

    @Column(name = "consultation_fee", nullable = false, precision = 12, scale = 2)
    private BigDecimal consultationFee;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
