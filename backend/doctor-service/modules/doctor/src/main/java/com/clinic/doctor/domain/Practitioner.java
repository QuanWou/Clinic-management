package com.clinic.doctor.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="practitioners",schema="doctor")
public class Practitioner {
    @Id public UUID id;
    @Column(name="platform_user_id",nullable=false,unique=true) public UUID platformUserId;
    @Column(name="display_name",nullable=false,length=180) public String displayName;
    @Column(name="registration_code",length=100) public String registrationCode;
    @Column(name="created_at",nullable=false) public Instant createdAt;
    @Column(name="updated_at",nullable=false) public Instant updatedAt;
    @Version @Column(name="row_version",nullable=false) public long version;
    @PrePersist void create(){if(id==null)id=UUID.randomUUID();createdAt=Instant.now();updatedAt=createdAt;}
    @PreUpdate void update(){updatedAt=Instant.now();}
}
