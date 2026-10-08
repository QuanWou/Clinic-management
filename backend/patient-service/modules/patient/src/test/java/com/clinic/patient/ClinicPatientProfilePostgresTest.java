package com.clinic.patient;
import com.clinic.patient.api.ApiProblem;
import com.clinic.patient.api.PatientDto.ProfileInput;
import com.clinic.patient.security.*;
import com.clinic.patient.service.*;
import com.clinic.patient.service.ClinicPatientProfileService.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import java.util.*;
import java.time.LocalDate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@SpringBootTest(properties={"patient.reception.enabled=true","patient.security.iam-service-secret=synthetic-patient-iam-secret-at-least-32-bytes","patient.security.clinic-service-secret=synthetic-patient-clinic-secret-at-least-32-bytes"})
@EnabledIfSystemProperty(named="patient.it.enabled",matches="true")
class ClinicPatientProfilePostgresTest {
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired ClinicPatientProfileService service;@Autowired ReceptionPatientService reception;@Autowired PatientService patients;@Autowired JdbcTemplate jdbc;
 @MockBean IamAuthorizationClient iam;@MockBean ClinicDirectoryClient clinics;
 UUID clinic=UUID.randomUUID(),branch=UUID.randomUUID();Actor actor=new Actor(UUID.randomUUID(),Set.of("ROLE_PATIENT"));
 @BeforeEach void allow(){when(iam.decide(any(),eq("CLINIC_CONFIG"),any(),isNull())).thenReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"ADMIN",1,"SYNTHETIC"));when(iam.decide(any(),eq("RECEPTION"),any(),any())).thenReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"STAFF",1,"SYNTHETIC"));}
 Input input(String name,long version){return new Input(name,null,"","0001234567","",version,"Synthetic reviewed change");}
 @Test void walkInAndOnlineProfilesAppearWithCorrectAccountIndicator(){
  var walk=reception.provisional(actor,clinic,branch,"walk",new ReceptionPatientService.ProvisionalInput("Synthetic Walk In",null,"0001234567","Synthetic intake"));
  Actor patient=new Actor(UUID.randomUUID(),Set.of("ROLE_PATIENT"));var online=patients.upsertOwn(patient,new ProfileInput("Synthetic Online",LocalDate.of(1990,1,1),"MALE",null,null,0));patients.ensureClinicLink(clinic,online.patientId());
  var rows=service.list(actor,clinic,"","","",0,20);assertEquals(2,rows.totalElements());
  assertFalse(service.detail(actor,clinic,walk.patientId()).profile().hasAccount());assertTrue(service.detail(actor,clinic,online.patientId()).profile().hasAccount());
  assertEquals(1,service.list(actor,clinic,"","","NONE",0,20).totalElements());assertEquals(1,service.list(actor,clinic,"","VERIFIED","LINKED",0,20).totalElements());
  assertEquals(0,service.list(actor,UUID.randomUUID(),"","","",0,20).totalElements());assertThrows(ApiProblem.class,()->service.detail(actor,UUID.randomUUID(),walk.patientId()));
  assertEquals(0,jdbc.queryForObject("select count(*) from patient_v2.patient_identities",Integer.class));
 }
 @Test void createIsIdempotentAndDoesNotCreateOrMergeAnAccount(){
  var a=service.create(actor,clinic,"same",input("Synthetic Profile",0));var retry=service.create(actor,clinic,"same",input("Synthetic Profile",0));
  assertEquals(a.patientId(),retry.patientId());assertFalse(a.hasAccount());assertNull(a.dateOfBirth());assertEquals("PROVISIONAL",a.status());
  assertThrows(ApiProblem.class,()->service.create(actor,clinic,"same",input("Changed payload",0)));
  var b=service.create(actor,clinic,"different",input("Synthetic Profile",0));assertNotEquals(a.patientId(),b.patientId());assertEquals(2,service.list(actor,clinic,"","","",0,20).totalElements());
  assertEquals(1,service.detail(actor,clinic,a.patientId()).changes().size());assertThrows(ApiProblem.class,()->patients.booking(a.patientId()));
 }
 @Test void updateIsVersionedScopedAndAuditedWithoutChangingAccountOwnership(){
  var p=service.create(actor,clinic,"update",input("Synthetic Before",0));
  assertThrows(ApiProblem.class,()->service.update(actor,UUID.randomUUID(),p.patientId(),input("Forbidden change",0)));
  var updated=service.update(actor,clinic,p.patientId(),input("Synthetic After",p.version()));assertEquals(p.version()+1,updated.version());assertFalse(updated.hasAccount());
  assertThrows(ApiProblem.class,()->service.update(actor,clinic,p.patientId(),input("Stale overwrite",p.version())));
  var detail=service.detail(actor,clinic,p.patientId());assertEquals("Synthetic After",detail.profile().fullName());assertEquals(2,detail.changes().size());assertEquals("fullName",detail.changes().getFirst().changedFields());assertEquals(actor.id(),detail.changes().getFirst().actorUserId());
 }
 @Test void permissionRevocationFailsClosedForEveryOperation(){
  var p=service.create(actor,clinic,"revoked",input("Synthetic Revoke",0));
  when(iam.decide(eq(actor.id()),eq("CLINIC_CONFIG"),eq(clinic),isNull())).thenReturn(new IamAuthorizationClient.Decision(false,null,null,2,"REVOKED"));
  assertThrows(ApiProblem.class,()->service.list(actor,clinic,"","","",0,20));assertThrows(ApiProblem.class,()->service.detail(actor,clinic,p.patientId()));
  assertThrows(ApiProblem.class,()->service.create(actor,clinic,"new",input("Denied",0)));assertThrows(ApiProblem.class,()->service.update(actor,clinic,p.patientId(),input("Denied",0)));
 }
 @Test void searchEscapesWildcardsAndPaginationIsStable(){
  service.create(actor,clinic,"a",input("Synthetic 100% Match",0));service.create(actor,clinic,"b",input("Synthetic 1000 Match",0));
  assertEquals(1,service.list(actor,clinic,"100%","","",0,20).totalElements());assertEquals(2,service.list(actor,clinic,"","","",0,1).totalPages());
  assertNotEquals(service.list(actor,clinic,"","","",0,1).content().getFirst().patientId(),service.list(actor,clinic,"","","",1,1).content().getFirst().patientId());
  assertThrows(ApiProblem.class,()->service.list(actor,clinic,"","REVOKED","",0,20));assertThrows(ApiProblem.class,()->service.list(actor,clinic,"","","",-1,20));
 }
}
