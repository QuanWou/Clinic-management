package com.clinic.v2.appointment.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity
@Table(name="appointments",schema="appointment_v2")
public class Appointment{
 @Id public UUID id;
 @Column(name="appointment_code",nullable=false,unique=true,length=40) public String appointmentCode;
 @Column(name="clinic_id",nullable=false) public UUID clinicId;
 @Column(name="branch_id",nullable=false) public UUID branchId;
 @Column(name="patient_id",nullable=false) public UUID patientId;
 @Column(name="clinic_patient_link_id",nullable=false) public UUID clinicPatientLinkId;
 @Column(name="offering_id",nullable=false) public UUID offeringId;
 @Column(name="doctor_id",nullable=false) public UUID doctorId;
 @Column(name="slot_id",nullable=false) public UUID slotId;
 @Column(name="reservation_id",nullable=false,unique=true) public UUID reservationId;
 @Column(name="price_version_id",nullable=false) public UUID priceVersionId;
 @Column(name="amount_vnd",nullable=false) public long amountVnd;
 @Column(nullable=false,length=3) public String currency;
 @Column(name="price_effective_from",nullable=false) public Instant priceEffectiveFrom;
 @Column(name="tax_policy_code",length=80) public String taxPolicyCode;
 @Column(name="discount_policy_code",length=80) public String discountPolicyCode;
 @Column(nullable=false,length=32) public String status;
 @Column(name="confirmation_key",nullable=false,length=120) public String confirmationKey;
 @Column(name="created_at",nullable=false) public Instant createdAt;
 @Column(name="updated_at",nullable=false) public Instant updatedAt;
 @Column(name="cancelled_at") public Instant cancelledAt;
 @Column(name="prior_encounter_id") public UUID priorEncounterId;
 @Column(name="prior_branch_id") public UUID priorBranchId;
 @Column(name="prior_medical_version") public Long priorMedicalVersion;
 @Column(name="prior_proposed_date") public java.time.LocalDate priorProposedDate;
 @Version @Column(name="row_version",nullable=false) public long version;
 @PrePersist void create(){if(id==null)id=UUID.randomUUID();createdAt=Instant.now();updatedAt=createdAt;}
 @PreUpdate void update(){updatedAt=Instant.now();}
}
