package com.clinic.v2.search.domain;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.*;

@Entity
@Table(name="public_doctors",schema="search_v2")
@IdClass(PublicDoctor.Key.class)
public class PublicDoctor {
  @Id @Column(name="doctor_id") public UUID doctorId;
  @Id @Column(name="clinic_id") public UUID clinicId;
  @Id @Column(name="branch_id") public UUID branchId;
  @Column(name="display_name",nullable=false,length=180) public String displayName;
  @Column(name="specialty_code",length=80) public String specialtyCode;
  @Column(name="specialty_name",length=180) public String specialtyName;
  @Column(name="professional_title",length=180) public String professionalTitle;
  @Column(name="public_visible",nullable=false) public boolean publicVisible;
  @Column(name="source_version",nullable=false) public long sourceVersion;
  @Column(name="indexed_at",nullable=false) public Instant indexedAt;
  @PrePersist @PreUpdate void touch(){indexedAt=Instant.now();}

  public static class Key implements Serializable{
    public UUID doctorId; public UUID clinicId; public UUID branchId;
    public Key(){}
    public Key(UUID doctorId,UUID clinicId,UUID branchId){this.doctorId=doctorId;this.clinicId=clinicId;this.branchId=branchId;}
    @Override public boolean equals(Object o){return o instanceof Key k&&Objects.equals(doctorId,k.doctorId)&&Objects.equals(clinicId,k.clinicId)&&Objects.equals(branchId,k.branchId);}
    @Override public int hashCode(){return Objects.hash(doctorId,clinicId,branchId);}
  }
}
