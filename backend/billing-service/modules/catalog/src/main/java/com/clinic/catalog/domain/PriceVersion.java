package com.clinic.catalog.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="price_versions",schema="catalog_v2")
public class PriceVersion {
    @Id public UUID id;
    @Column(name="clinic_id",nullable=false) public UUID clinicId;
    @Column(name="branch_id",nullable=false) public UUID branchId;
    @Column(name="offering_id",nullable=false) public UUID offeringId;
    @Column(name="branch_offering_id",nullable=false) public UUID branchOfferingId;
    @Column(name="amount_vnd",nullable=false) public long amountVnd;
    @Column(nullable=false,length=3) public String currency="VND";
    @Column(name="tax_policy_code",length=80) public String taxPolicyCode;
    @Column(name="discount_policy_code",length=80) public String discountPolicyCode;
    @Column(name="effective_from",nullable=false) public Instant effectiveFrom;
    @Column(name="created_by",nullable=false) public UUID createdBy;
    @Column(name="created_at",nullable=false) public Instant createdAt;
    @PrePersist void create(){if(id==null)id=UUID.randomUUID();createdAt=Instant.now();}
}
