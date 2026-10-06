package com.clinic.patient;
import com.clinic.patient.api.PatientDto.*;
import com.clinic.patient.api.ApiProblem;
import com.clinic.patient.security.Actor;
import com.clinic.patient.service.PatientService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@EnabledIfSystemProperty(named="patient.it.enabled",matches="true")
class PatientPostgresTest{
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired PatientService service;@Autowired JdbcTemplate jdbc;@Autowired com.clinic.patient.api.NotificationRecipientController recipientController;
 @Autowired org.springframework.transaction.PlatformTransactionManager manager;
 Actor actor=new Actor(UUID.randomUUID(),Set.of("ROLE_PATIENT"));
 ProfileInput input(long version){return new ProfileInput("Synthetic Patient",LocalDate.of(1990,1,1),null,"0000000000","synthetic@example.invalid",version);}
 @Test void billingRecipientReadRequiresDedicatedPeerAndActiveActualPatientClinicLink(){
  var p=service.upsertOwn(actor,input(0));UUID clinic=UUID.randomUUID();service.ensureClinicLink(clinic,p.patientId());
  var peer=new com.clinic.patient.security.WorkloadPrincipal("billing-service",Set.of("patient.notification.recipient"));
  assertThrows(ApiProblem.class,()->recipientController.read(null,clinic,p.patientId()));assertThrows(ApiProblem.class,()->recipientController.read(new com.clinic.patient.security.WorkloadPrincipal("appointment-service",Set.of("patient.notification.recipient")),clinic,p.patientId()));
  var result=recipientController.read(peer,clinic,p.patientId());assertEquals("OWNED",result.status());assertEquals(actor.id(),result.userId());assertNotEquals(p.patientId(),result.userId());assertEquals("LINK_UNAVAILABLE",recipientController.read(peer,UUID.randomUUID(),p.patientId()).status());
  UUID temporary=UUID.randomUUID();new org.springframework.transaction.support.TransactionTemplate(manager).execute(t->{jdbc.queryForObject("select set_config('app.patient_mode','reception',true)",String.class);jdbc.queryForObject("select set_config('app.clinic_id',?,true)",String.class,clinic.toString());jdbc.update("insert into patient_v2.patient_identities(id,full_name,origin_clinic_id) values(?,'Synthetic temporary',?)",temporary,clinic);jdbc.update("insert into patient_v2.clinic_patient_links(id,clinic_id,patient_id,patient_code,status) values(?,?,?,?,'PROVISIONAL')",UUID.randomUUID(),clinic,temporary,"PT-"+temporary);jdbc.update("update patient_v2.clinic_patient_links set status='REVOKED',row_version=row_version+1 where clinic_id=? and patient_id=?",clinic,p.patientId());return null;});
  assertEquals("NO_ACCOUNT",recipientController.read(peer,clinic,temporary).status());assertNull(recipientController.read(peer,clinic,temporary).userId());assertEquals("LINK_UNAVAILABLE",recipientController.read(peer,clinic,p.patientId()).status());assertEquals(0,jdbc.queryForObject("select count(*) from patient_v2.platform_user_patient_links",Integer.class));
 }
 @Test void ownProfileNeverMergesByContactAndMissingContextFailsClosed(){
  var a=service.upsertOwn(actor,input(0));
  var other=new Actor(UUID.randomUUID(),Set.of("ROLE_PATIENT"));
  var b=service.upsertOwn(other,input(0));
  assertNotEquals(a.patientId(),b.patientId());
  assertEquals(a.patientId(),service.own(actor).patientId());
  assertEquals(0,jdbc.queryForObject("select count(*) from patient_v2.patient_identities",Integer.class));
  assertEquals(0,jdbc.queryForObject("select count(*) from patient_v2.platform_user_patient_links",Integer.class));
  service.upsertOwn(actor,new ProfileInput("Synthetic Updated",LocalDate.of(1990,1,1),null,"0000000000","synthetic@example.invalid",a.version()));
  assertThrows(ApiProblem.class,()->service.upsertOwn(actor,input(a.version())));
  assertThrows(ApiProblem.class,()->service.own(new Actor(UUID.randomUUID(),Set.of("ROLE_PATIENT"))));
 }
 @Test void ownClinicHistoryFollowsPatientLinkNotContactOrUserUuidAndRevokeIsImmediate(){
  var mine=service.upsertOwn(actor,input(0));var other=new Actor(UUID.randomUUID(),Set.of("ROLE_PATIENT"));var theirs=service.upsertOwn(other,input(0));var clinic=UUID.randomUUID();var hidden=UUID.randomUUID();
  service.ensureClinicLink(clinic,mine.patientId());service.ensureClinicLink(hidden,theirs.patientId());
  assertNotEquals(actor.id(),mine.patientId());assertEquals(List.of(clinic),service.ownClinicLinks(actor).stream().map(OwnClinicLink::clinicId).toList());assertEquals(mine.patientId(),service.ownClinicLink(actor,clinic).patientId());assertThrows(ApiProblem.class,()->service.ownClinicLink(actor,hidden));
  assertEquals(0,jdbc.queryForObject("select count(*) from patient_v2.clinic_patient_links",Integer.class));
  new org.springframework.transaction.support.TransactionTemplate(manager).execute(t->{jdbc.queryForObject("select set_config('app.patient_mode','reception',true)",String.class);jdbc.queryForObject("select set_config('app.clinic_id',?,true)",String.class,clinic.toString());jdbc.update("update patient_v2.clinic_patient_links set status='REVOKED',row_version=row_version+1 where clinic_id=?",clinic);return null;});
  assertTrue(service.ownClinicLinks(actor).isEmpty());assertThrows(ApiProblem.class,()->service.ownClinicLink(actor,clinic));assertEquals(theirs.patientId(),service.ownClinicLink(other,hidden).patientId());
 }
 @Test void concurrentClinicLinkIsOneVerifiedSourceLink()throws Exception{
  var profile=service.upsertOwn(actor,input(0));UUID clinic=UUID.randomUUID();
  var executor=Executors.newFixedThreadPool(2);
  try{
   var barrier=new CyclicBarrier(2);
   var first=executor.submit(()->{barrier.await();return service.ensureClinicLink(clinic,profile.patientId());});
   var second=executor.submit(()->{barrier.await();return service.ensureClinicLink(clinic,profile.patientId());});
   assertEquals(first.get(20,TimeUnit.SECONDS).id(),second.get(20,TimeUnit.SECONDS).id());
   assertEquals(0,jdbc.queryForObject("select count(*) from patient_v2.clinic_patient_links",Integer.class));
   assertEquals(actor.id(),service.booking(profile.patientId()).platformUserId());
  }finally{executor.shutdownNow();}
 }
}
