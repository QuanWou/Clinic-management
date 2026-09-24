package com.clinic.medicalrecord.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "prescription_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PrescriptionItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prescription_id", nullable = false)
    private Prescription prescription;

    @Column(name = "medicine_id")
    private UUID medicineId;

    @Column(name = "medicine_code", length = 100)
    private String medicineCode;

    @Column(name = "medicine_name", nullable = false, length = 255)
    private String medicineName;

    @Column(name = "medicine_unit", length = 100)
    private String medicineUnit;

    @Column(name = "dosage", nullable = false, length = 100)
    private String dosage;

    @Column(name = "frequency", nullable = false, length = 100)
    private String frequency;

    @Column(name = "duration", nullable = false, length = 100)
    private String duration;

    @Column(name = "route", length = 100)
    private String route;

    @Column(name = "quantity")
    private Integer quantity;

    @Column(name = "note", length = 500)
    private String note;
}
