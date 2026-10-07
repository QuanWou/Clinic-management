package com.clinic.catalog.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="branch_offerings",schema="catalog_v2")
public class BranchOffering {
    @Id public UUID id;
    @Column(name="clinic_id",nullable=false) public UUID clinicId;
    @Column(name="branch_id",nullable=false) public UUID branchId;
    @Column(name="offering_id",nullable=false) public UUID offeringId;
    @Column(nullable=false) public boolean active=true;
    @Column(name="public_visible",nullable=false) public boolean publicVisible;
    @Column(name="duration_minutes") public Integer durationMinutes;
    @Column(name="created_at",nullable=false) public Instant createdAt;
    @Column(name="updated_at",nullable=false) public Instant updatedAt;
    @Version @Column(name="row_version",nullable=false) public long version;
    @PrePersist void create(){if(id==null)id=UUID.randomUUID();createdAt=Instant.now();updatedAt=createdAt;}
    @PreUpdate void update(){updatedAt=Instant.now();}
}
