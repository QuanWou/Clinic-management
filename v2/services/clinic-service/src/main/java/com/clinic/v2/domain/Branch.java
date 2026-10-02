package com.clinic.v2.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="branches",schema="clinic",uniqueConstraints=@UniqueConstraint(columnNames={"clinic_id","name"}))
public class Branch {
    @Id public UUID id;
    @Column(name="clinic_id",nullable=false) public UUID clinicId;
    @Column(nullable=false,length=180) public String name;
    @Column(nullable=false,length=300) public String address;
    @Column(name="opening_hours",nullable=false,length=300) public String openingHours;
    @Column(nullable=false) public boolean active=true;
    @Column(name="created_at",nullable=false) public Instant createdAt;
    @Column(name="updated_at",nullable=false) public Instant updatedAt;
    @PrePersist void initial(){if(id==null)id=UUID.randomUUID();createdAt=Instant.now();updatedAt=createdAt;}
    @PreUpdate void updated(){updatedAt=Instant.now();}
}
