package com.clinic.v2.catalog.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="offerings",schema="catalog_v2",uniqueConstraints=@UniqueConstraint(columnNames={"clinic_id","code"}))
public class Offering {
    @Id public UUID id;
    @Column(name="clinic_id",nullable=false) public UUID clinicId;
    @Column(nullable=false,length=60) public String code;
    @Column(nullable=false,length=220) public String name;
    @Column(length=1000) public String description;
    @Column(name="specialty_code",length=60) public String specialtyCode;
    @Column(nullable=false) public boolean active=true;
    @Column(name="created_at",nullable=false) public Instant createdAt;
    @Column(name="updated_at",nullable=false) public Instant updatedAt;
    @Version @Column(name="row_version",nullable=false) public long version;
    @PrePersist void create(){if(id==null)id=UUID.randomUUID();createdAt=Instant.now();updatedAt=createdAt;}
    @PreUpdate void update(){updatedAt=Instant.now();}
}
