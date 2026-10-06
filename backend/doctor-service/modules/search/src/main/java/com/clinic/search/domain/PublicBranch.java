package com.clinic.search.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="public_branches",schema="search_v2")
public class PublicBranch {
  @Id @Column(name="branch_id") public UUID branchId;
  @Column(name="clinic_id",nullable=false) public UUID clinicId;
  @Column(nullable=false,length=180) public String name;
  @Column(nullable=false,length=300) public String address;
  @Column(name="opening_hours",nullable=false,length=300) public String openingHours;
  @Column(nullable=false) public boolean active;
  @Column(name="source_version",nullable=false) public long sourceVersion;
  @Column(name="indexed_at",nullable=false) public Instant indexedAt;
  @PrePersist @PreUpdate void touch(){indexedAt=Instant.now();}
}
