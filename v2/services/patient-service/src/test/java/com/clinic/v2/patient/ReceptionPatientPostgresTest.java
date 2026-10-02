package com.clinic.v2.patient;
import com.clinic.v2.patient.api.ApiProblem;
import com.clinic.v2.patient.security.*;
import com.clinic.v2.patient.service.*;
import com.clinic.v2.patient.service.ReceptionPatientService.*;
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
class ReceptionPatientPostgresTest {
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired ReceptionPatientService service;@Autowired PatientService patients;@Autowired JdbcTemplate jdbc;
 @MockBean IamAuthorizationClient iam;@MockBean ClinicDirectoryClient clinic;
 UUID clinicId=UUID.randomUUID(),branchId=UUID.randomUUID();Actor actor=new Actor(UUID.randomUUID(),Set.of("ROLE_RECEPTIONIST"));
 @BeforeEach void authorize(){when(iam.decide(any(),eq("RECEPTION"),any(),any())).thenReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"RECEPTIONIST",1,"SYNTHETIC"));}
 @Test void sharedContactOnlySuggestsWithoutAutoMergeAndMissingDobNeedsNoAccount(){
  var input=new ProvisionalInput("Synthetic Reception Patient",null,"0001234567","Synthetic walk-in reason");
  var a=service.provisional(actor,clinicId,branchId,"one",input);var b=service.provisional(actor,clinicId,branchId,"two",input);
  assertNotEquals(a.patientId(),b.patientId());assertNull(a.dateOfBirth());assertEquals("4567",a.phoneLast4());assertEquals("PROVISIONAL",a.status());
  assertEquals(a.patientId(),service.provisional(actor,clinicId,branchId,"one",input).patientId());
  assertEquals(2,service.suggestions(actor,clinicId,branchId,null,null,"0001234567").size());
  assertTrue(service.suggestions(actor,UUID.randomUUID(),branchId,null,null,"0001234567").isEmpty());
  assertThrows(ApiProblem.class,()->patients.booking(a.patientId()));assertEquals(0,jdbc.queryForObject("select count(*) from patient_v2.patient_identities",Integer.class));
  assertThrows(ApiProblem.class,()->service.provisional(actor,clinicId,branchId,"one",new ProvisionalInput("Different synthetic patient",null,null,"Reason")));
 }
 @Test void explicitReviewKeepsUserLinkAbsentAndRevokeDeniesNextRequest(){
  var p=service.provisional(actor,clinicId,branchId,"review",new ProvisionalInput("Synthetic Reviewed Patient",LocalDate.of(1990,1,1),null,"Synthetic intake"));
  var verified=service.review(actor,clinicId,branchId,p.patientId(),new ReviewInput(p.version(),"synthetic-evidence-reference","Synthetic review"));assertEquals("VERIFIED",verified.status());assertEquals(p.patientId(),verified.patientId());
  assertThrows(ApiProblem.class,()->patients.booking(p.patientId()));assertEquals("VERIFIED",patients.existingClinicLink(clinicId,p.patientId()).status());
  assertThrows(ApiProblem.class,()->patients.existingClinicLink(UUID.randomUUID(),p.patientId()));
  when(iam.decide(eq(actor.id()),eq("RECEPTION"),eq(clinicId),eq(branchId))).thenReturn(new IamAuthorizationClient.Decision(false,null,null,2,"REVOKED"));
  assertThrows(ApiProblem.class,()->service.suggestions(actor,clinicId,branchId,"Synthetic Reviewed Patient",LocalDate.of(1990,1,1),null));
 }
}
