package com.clinic.v2.patient.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity
@Table(name="platform_user_patient_links",schema="patient_v2")
public class UserPatientLink{
 @Id @Column(name="user_id") public UUID userId;
 @Column(name="patient_id",nullable=false,unique=true) public UUID patientId;
 @Column(name="created_at",nullable=false) public Instant createdAt;
 @PrePersist void create(){createdAt=Instant.now();}
}
