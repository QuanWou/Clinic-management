package com.clinic.search.domain;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.*;

@Entity
@Table(name="public_offerings",schema="search_v2")
@IdClass(PublicOffering.Key.class)
public class PublicOffering {
  @Id @Column(name="offering_id") public UUID offeringId;
  @Id @Column(name="clinic_id") public UUID clinicId;
  @Id @Column(name="branch_id") public UUID branchId;
  @Column(nullable=false,length=80) public String code;
  @Column(nullable=false,length=180) public String name;
  @Column(name="specialty_code",length=80) public String specialtyCode;
  @Column(name="amount_vnd") public Long amountVnd;
  @Column(nullable=false,length=3) public String currency="VND";
  @Column(name="price_version_id") public UUID priceVersionId;
  @Column(name="effective_from") public Instant effectiveFrom;
  @Column(name="public_visible",nullable=false) public boolean publicVisible;
  @Column(name="source_version",nullable=false) public long sourceVersion;
  @Column(name="indexed_at",nullable=false) public Instant indexedAt;
  @PrePersist @PreUpdate void touch(){indexedAt=Instant.now();}
  public static class Key implements Serializable{
    public UUID offeringId; public UUID clinicId; public UUID branchId;
    public Key(){}
    public Key(UUID offeringId,UUID clinicId,UUID branchId){this.offeringId=offeringId;this.clinicId=clinicId;this.branchId=branchId;}
    @Override public boolean equals(Object o){return o instanceof Key k&&Objects.equals(offeringId,k.offeringId)&&Objects.equals(clinicId,k.clinicId)&&Objects.equals(branchId,k.branchId);}
    @Override public int hashCode(){return Objects.hash(offeringId,clinicId,branchId);}
  }
}
