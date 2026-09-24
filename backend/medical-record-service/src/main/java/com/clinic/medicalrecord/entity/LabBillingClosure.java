package com.clinic.medicalrecord.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "lab_billing_closures")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LabBillingClosure {
    @Id
    @Column(name = "appointment_id")
    private UUID appointmentId;

    @Column(name = "finalized", nullable = false)
    private boolean finalized;

    @Column(name = "revision", length = 64)
    private String revision;

    @Column(name = "finalized_at")
    private LocalDateTime finalizedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;
}
