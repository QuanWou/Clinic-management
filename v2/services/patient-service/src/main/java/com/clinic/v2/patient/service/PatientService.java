package com.clinic.v2.patient.service;

import com.clinic.v2.patient.api.*;
import com.clinic.v2.patient.api.PatientDto.*;
import com.clinic.v2.patient.domain.*;
import com.clinic.v2.patient.repo.*;
import com.clinic.v2.patient.security.Actor;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
public class PatientService{
 private final PatientIdentityRepository patients;private final UserPatientLinkRepository users;private final ClinicPatientLinkRepository clinics;
 private final JdbcTemplate jdbc;
 public PatientService(PatientIdentityRepository patients,UserPatientLinkRepository users,ClinicPatientLinkRepository clinics,JdbcTemplate jdbc){
   this.patients=patients;this.users=users;this.clinics=clinics;this.jdbc=jdbc;
 }

 @Transactional
 public ProfileView upsertOwn(Actor actor,ProfileInput in){
  userContext(actor);
  jdbc.execute("select pg_advisory_xact_lock(hashtextextended('patient-user:"+actor.id()+"',0))");
  UserPatientLink link=users.findById(actor.id()).orElse(null);
  PatientIdentity p;
  if(link==null){
   p=new PatientIdentity();p.fullName=in.fullName().trim();p.dateOfBirth=in.dateOfBirth();p.sex=trim(in.sex());p.phone=trim(in.phone());p.email=trim(in.email());patients.saveAndFlush(p);
   link=new UserPatientLink();link.userId=actor.id();link.patientId=p.id;users.save(link);
  }else{
   p=patients.findById(link.patientId).orElseThrow(ApiProblem::missing);
   if(in.expectedVersion()!=p.version)throw ApiProblem.conflict("Patient profile changed; reload before saving");
   p.fullName=in.fullName().trim();p.dateOfBirth=in.dateOfBirth();p.sex=trim(in.sex());p.phone=trim(in.phone());p.email=trim(in.email());patients.saveAndFlush(p);
  }
  return view(p);
 }
 @Transactional(readOnly=true)
 public ProfileView own(Actor actor){
  userContext(actor);
  var link=users.findById(actor.id()).orElseThrow(ApiProblem::missing);
  return view(patients.findById(link.patientId).orElseThrow(ApiProblem::missing));
 }
 @Transactional(readOnly=true)
 public BookingIdentity booking(UUID patientId){
  internalPatient(patientId);
  var link=users.findByPatientId(patientId).orElseThrow(ApiProblem::missing);
  if(!patients.existsById(patientId))throw ApiProblem.missing();
  return new BookingIdentity(patientId,link.userId,true);
 }
 @Transactional
 public ClinicLinkView ensureClinicLink(UUID clinicId,UUID patientId){
  internalPatient(patientId);
  jdbc.queryForObject("select set_config('app.clinic_id',?,true)",String.class,clinicId.toString());
  jdbc.execute("select pg_advisory_xact_lock(hashtextextended('patient-link:"+clinicId+":"+patientId+"',0))");
  if(!patients.existsById(patientId))throw ApiProblem.missing();
  ClinicPatientLink l=clinics.findByClinicIdAndPatientId(clinicId,patientId).orElseGet(()->{
   ClinicPatientLink x=new ClinicPatientLink();x.clinicId=clinicId;x.patientId=patientId;
   x.patientCode="PT-"+patientId.toString().replace("-","").toUpperCase(Locale.ROOT);x.status="VERIFIED";x.verifiedAt=Instant.now();return x;
  });
  if(!"VERIFIED".equals(l.status))throw ApiProblem.conflict("Patient clinic link requires review");
  clinics.saveAndFlush(l);return new ClinicLinkView(l.id,l.clinicId,l.patientId,l.patientCode,l.status,l.version);
 }
 @Transactional(readOnly=true)
 public ClinicLinkView existingClinicLink(UUID clinicId,UUID patientId){
  internalPatient(patientId);jdbc.queryForObject("select set_config('app.clinic_id',?,true)",String.class,clinicId.toString());
  var l=clinics.findByClinicIdAndPatientId(clinicId,patientId).orElseThrow(ApiProblem::missing);
  if(!Set.of("PROVISIONAL","VERIFIED").contains(l.status))throw ApiProblem.missing();
  return new ClinicLinkView(l.id,l.clinicId,l.patientId,l.patientCode,l.status,l.version);
 }
 private void userContext(Actor actor){
   if(actor==null)throw ApiProblem.forbidden();
   jdbc.queryForObject("select set_config('app.user_id',?,true)",String.class,actor.id().toString());
 }
 @Transactional(readOnly=true)
 public List<OwnClinicLink> ownClinicLinks(Actor actor){
  UUID patient=ownPatientContext(actor);if(patient==null)return List.of();
  return jdbc.query("select clinic_id,patient_id,status from patient_v2.clinic_patient_links where patient_id=? and status in ('PROVISIONAL','VERIFIED') order by created_at desc limit 100",(rs,n)->new OwnClinicLink(rs.getObject("clinic_id",UUID.class),rs.getObject("patient_id",UUID.class),rs.getString("status")),patient);
 }
 @Transactional(readOnly=true)
 public OwnClinicLink ownClinicLink(Actor actor,UUID clinicId){
  UUID patient=ownPatientContext(actor);if(patient==null)throw ApiProblem.missing();
  var rows=jdbc.query("select clinic_id,patient_id,status from patient_v2.clinic_patient_links where patient_id=? and clinic_id=? and status in ('PROVISIONAL','VERIFIED')",(rs,n)->new OwnClinicLink(rs.getObject("clinic_id",UUID.class),rs.getObject("patient_id",UUID.class),rs.getString("status")),patient,clinicId);
  if(rows.isEmpty())throw ApiProblem.missing();return rows.getFirst();
 }
 public record NotificationRecipient(String status,UUID userId){}
 @Transactional(readOnly=true)
 public NotificationRecipient notificationRecipient(UUID clinicId,UUID patientId){
  internalPatient(patientId);jdbc.queryForObject("select set_config('app.clinic_id',?,true)",String.class,clinicId.toString());
  var links=clinics.findByClinicIdAndPatientId(clinicId,patientId);
  if(links.isEmpty()||!Set.of("PROVISIONAL","VERIFIED").contains(links.get().status))return new NotificationRecipient("LINK_UNAVAILABLE",null);
  var owner=users.findByPatientId(patientId);
  return owner.map(l->new NotificationRecipient("OWNED",l.userId)).orElseGet(()->new NotificationRecipient("NO_ACCOUNT",null));
 }
 private void internalPatient(UUID patientId){
   jdbc.queryForObject("select set_config('app.patient_id',?,true)",String.class,patientId.toString());
 }
 private UUID ownPatientContext(Actor actor){
  userContext(actor);var link=users.findById(actor.id()).orElse(null);UUID patient=link==null?null:link.patientId;
  jdbc.queryForObject("select set_config('app.own_patient_id',?,true)",String.class,patient==null?"":patient.toString());return patient;
 }
 private ProfileView view(PatientIdentity p){return new ProfileView(p.id,p.fullName,p.dateOfBirth,p.sex,p.phone,p.email,p.version);}
 private String trim(String s){return s==null||s.isBlank()?null:s.trim();}
}
