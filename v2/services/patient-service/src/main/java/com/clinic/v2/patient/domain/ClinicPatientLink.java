package com.clinic.v2.patient.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity
@Table(name="clinic_patient_links",schema="patient_v2")
public class ClinicPatientLink{
 @Id public UUID id;
 @Column(name="clinic_id",nullable=false) public UUID clinicId;
 @Column(name="patient_id",nullable=false) public UUID patientId;
 @Column(name="patient_code",nullable=false,length=40) public String patientCode;
 @Column(nullable=false,length=24) public String status;
 @Column(name="created_at",nullable=false) public Instant createdAt;
 @Column(name="verified_at") public Instant verifiedAt;
 @Version @Column(name="row_version",nullable=false) public long version;
 @PrePersist void create(){if(id==null)id=UUID.randomUUID();createdAt=Instant.now();}
}
