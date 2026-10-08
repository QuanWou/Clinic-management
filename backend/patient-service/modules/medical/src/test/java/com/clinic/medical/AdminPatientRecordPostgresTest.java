package com.clinic.medical;
import com.clinic.medical.api.*;
import com.clinic.medical.api.MedicalDto.Note;
import com.clinic.medical.security.*;
import com.clinic.medical.service.AdminPatientRecordService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@SpringBootTest(properties={"medical.security.iam-service-secret=synthetic-medical-iam-secret-at-least-32-bytes","medical.security.clinic-service-secret=synthetic-medical-clinic-secret-at-least-32-bytes","medical.security.service-secret=synthetic-medical-service-secret-at-least-32-bytes"})
@EnabledIfSystemProperty(named="medical.it.enabled",matches="true")
class AdminPatientRecordPostgresTest {
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired AdminPatientRecordService service;@Autowired JdbcTemplate jdbc;@Autowired MedicalDb db;@Autowired PlatformTransactionManager manager;@Autowired ObjectMapper json;@Autowired ClinicalAccessAuditAdvice audit;
 @MockBean IamAuthorizationClient iam;
 UUID clinic=UUID.randomUUID(),branch=UUID.randomUUID(),patient=UUID.randomUUID(),visit=UUID.randomUUID(),order=UUID.randomUUID();
 Actor actor=new Actor(UUID.randomUUID(),Set.of("ROLE_PATIENT"),"Bearer synthetic");
 @BeforeEach void fixture()throws Exception{
  when(iam.decide(any(),eq("CLINIC_CONFIG"),any(),isNull())).thenReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"ADMIN",1,"SYNTHETIC"));
  String note=json.writeValueAsString(new Note("Reason","History","Allergies","Vitals","Exam","Diagnosis","Conclusion","Treatment",null));
  new TransactionTemplate(manager).executeWithoutResult(t->{db.scope(clinic,branch);
   jdbc.update("insert into medical_v2.cases(encounter_id,clinic_id,branch_id,patient_id,doctor_id,status,document_version) values(?,?,?,?,?,'VALIDATED',2)",visit,clinic,branch,patient,UUID.randomUUID());
   jdbc.update("insert into medical_v2.document_versions(id,encounter_id,clinic_id,branch_id,version,content_json,content_hash,author_user_id) values(?,?,?,?,1,?,'synthetic',?)",UUID.randomUUID(),visit,clinic,branch,note.replace("Diagnosis","Old diagnosis"),actor.id());
   jdbc.update("insert into medical_v2.document_versions(id,encounter_id,clinic_id,branch_id,version,content_json,content_hash,author_user_id) values(?,?,?,?,2,?,'synthetic',?)",UUID.randomUUID(),visit,clinic,branch,note,actor.id());
   jdbc.update("insert into medical_v2.orders(id,encounter_id,clinic_id,branch_id,offering_id,name,price_snapshot_json,ordered_by,state,result_version) values(?,?,?,?,?,'Synthetic Test','{}',?,'RESULTED',1)",order,visit,clinic,branch,UUID.randomUUID(),actor.id());
   jdbc.update("insert into medical_v2.results(id,order_id,clinic_id,branch_id,version,author_user_id,source_ref,content,content_hash) values(?,?,?,?,1,?,'synthetic','Synthetic result','synthetic')",UUID.randomUUID(),order,clinic,branch,actor.id());
  });
 }
 @Test void readsCurrentNoteAndUnreviewedResultForWalkInWithoutPatientAccount(){
  var r=service.get(actor,clinic,branch,patient,visit);assertEquals("VALIDATED",r.status());assertEquals(2,r.documentVersion());assertEquals("Diagnosis",r.content().preliminaryDiagnosis());assertEquals("Synthetic result",r.orders().getFirst().result());assertEquals("RESULTED",r.orders().getFirst().state());assertNull(r.orders().getFirst().reviewedAt());
  assertEquals(0,jdbc.queryForObject("select count(*) from medical_v2.cases",Integer.class));
 }
 @Test void patientClinicAndBranchAreAllRequiredAndRevocationFailsClosed(){
  assertThrows(ApiProblem.class,()->service.get(actor,clinic,branch,UUID.randomUUID(),visit));assertThrows(ApiProblem.class,()->service.get(actor,clinic,UUID.randomUUID(),patient,visit));assertThrows(ApiProblem.class,()->service.get(actor,UUID.randomUUID(),branch,patient,visit));
  when(iam.decide(any(),eq("CLINIC_CONFIG"),any(),isNull())).thenReturn(new IamAuthorizationClient.Decision(false,null,null,2,"REVOKED"));assertThrows(ApiProblem.class,()->service.get(actor,clinic,branch,patient,visit));
 }
 @Test void clinicianGrantCannotUseAdminReadEvenWithLegacyAdminRole(){
  when(iam.decide(any(),eq("CLINIC_CONFIG"),any(),isNull())).thenReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"DOCTOR",1,"SYNTHETIC"));assertThrows(ApiProblem.class,()->service.get(new Actor(actor.id(),Set.of("ROLE_ADMIN"),"Bearer synthetic"),clinic,branch,patient,visit));
 }
 @Test void clinicalAuditRecordsAccessMetadataWithoutClinicalBody(){
  var request=new org.springframework.mock.web.MockHttpServletRequest("GET","/api/clinics/"+clinic+"/branches/"+branch+"/admin/patients/"+patient+"/visits/"+visit+"/medical-record");var response=new org.springframework.mock.web.MockHttpServletResponse();
  org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(org.springframework.security.authentication.UsernamePasswordAuthenticationToken.authenticated(actor,null,List.of()));
  try{audit.beforeBodyWrite(Map.of("diagnosis","Confidential synthetic text"),null,org.springframework.http.MediaType.APPLICATION_JSON,null,new org.springframework.http.server.ServletServerHttpRequest(request),new org.springframework.http.server.ServletServerHttpResponse(response));
   new TransactionTemplate(manager).executeWithoutResult(t->{db.scope(clinic,branch);String event=jdbc.queryForObject("select payload_json from medical_v2.outbox_events where aggregate_id=?",String.class,visit);assertTrue(event.contains("ADMIN_READ_MEDICAL_RECORD"));assertTrue(event.contains("SUCCESS"));assertFalse(event.contains("Confidential"));});
  }finally{org.springframework.security.core.context.SecurityContextHolder.clearContext();}
 }
}
