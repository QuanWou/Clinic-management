package com.clinic.clinic.domain;
import jakarta.persistence.*;
import java.time.*;
import java.util.UUID;
@Entity @Table(name="clinic_licenses",schema="clinic")
public class ClinicLicense {
    @Id @Column(name="clinic_id") public UUID clinicId;
    @Column(name="license_number",length=100) public String licenseNumber;
    @Column(name="issuing_authority",length=180) public String issuingAuthority;
    @Column(name="scope_summary",length=500) public String scopeSummary;
    @Column(name="evidence_ref",length=200) public String evidenceRef;
    @Column(name="valid_until") public LocalDate validUntil;
    @Column(name="updated_at",nullable=false) public Instant updatedAt;
    @PrePersist @PreUpdate void timestamp(){updatedAt=Instant.now();}
}
