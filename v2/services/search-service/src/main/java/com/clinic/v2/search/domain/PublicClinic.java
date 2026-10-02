package com.clinic.v2.search.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="public_clinics",schema="search_v2")
public class PublicClinic {
  @Id @Column(name="clinic_id") public UUID clinicId;
  @Column(nullable=false,unique=true,length=80) public String slug;
  @Column(nullable=false,length=180) public String name;
  @Column(length=1000) public String description;
  @Column(name="location_text",length=300) public String locationText;
  @Column(nullable=false) public boolean published;
  @Column(name="source_version",nullable=false) public long sourceVersion;
  @Column(name="source_updated_at",nullable=false) public Instant sourceUpdatedAt;
  @Column(name="indexed_at",nullable=false) public Instant indexedAt;
  @PrePersist @PreUpdate void touch(){indexedAt=Instant.now();}
}
