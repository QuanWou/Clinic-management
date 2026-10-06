package com.clinic.patient.domain;
import jakarta.persistence.*;
import java.time.*;
import java.util.UUID;
@Entity
@Table(name="patient_identities",schema="patient_v2")
public class PatientIdentity{
 @Id public UUID id;
 @Column(name="full_name",nullable=false,length=180) public String fullName;
 @Column(name="date_of_birth",nullable=false) public LocalDate dateOfBirth;
 @Column(length=20) public String sex;
 @Column(length=30) public String phone;
 @Column(length=180) public String email;
 @Column(name="created_at",nullable=false) public Instant createdAt;
 @Column(name="updated_at",nullable=false) public Instant updatedAt;
 @Version @Column(name="row_version",nullable=false) public long version;
 @PrePersist void create(){if(id==null)id=UUID.randomUUID();createdAt=Instant.now();updatedAt=createdAt;}
 @PreUpdate void update(){updatedAt=Instant.now();}
}
