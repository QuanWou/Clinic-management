package com.clinic.clinic.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="clinics", schema="clinic")
public class Clinic {
    @Id public UUID id;
    @Column(name="owner_user_id",nullable=false) public UUID ownerUserId;
    @Column(nullable=false,length=80,unique=true) public String slug;
    @Column(nullable=false,length=180) public String name;
    @Column(name="public_description",length=1000) public String publicDescription;
    @Column(name="contact_name",length=150) public String contactName;
    @Column(name="contact_email",length=180) public String contactEmail;
    @Column(name="contact_phone",length=30) public String contactPhone;
    @Enumerated(EnumType.STRING) @Column(name="review_status",nullable=false,length=24) public ReviewStatus reviewStatus=ReviewStatus.DRAFT;
    @Enumerated(EnumType.STRING) @Column(name="publication_status",nullable=false,length=20) public PublicationStatus publicationStatus=PublicationStatus.UNPUBLISHED;
    @Column(name="evidence_verified",nullable=false) public boolean evidenceVerified;
    @Column(name="reviewed_by") public UUID reviewedBy;
    @Column(name="reviewed_at") public Instant reviewedAt;
    @Column(name="published_at") public Instant publishedAt;
    @Version @Column(name="row_version",nullable=false) public long version;
    @Column(name="created_at",nullable=false) public Instant createdAt;
    @Column(name="updated_at",nullable=false) public Instant updatedAt;
    @PrePersist void initial() {if(id==null)id=UUID.randomUUID();createdAt=Instant.now();updatedAt=createdAt;}
    @PreUpdate void updated() {updatedAt=Instant.now();}
}
