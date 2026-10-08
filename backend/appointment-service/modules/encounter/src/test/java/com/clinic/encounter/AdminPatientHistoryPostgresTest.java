package com.clinic.encounter;
import com.clinic.encounter.api.ApiProblem;
import com.clinic.encounter.security.*;
import com.clinic.encounter.service.AdminPatientHistoryService;
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

@SpringBootTest(properties={"encounter.security.iam-service-secret=synthetic-encounter-iam-secret-at-least-32-bytes","encounter.security.clinic-service-secret=synthetic-encounter-clinic-secret-at-least-32-bytes","encounter.security.service-secret=synthetic-encounter-service-secret-at-least-32-bytes"})
@EnabledIfSystemProperty(named="encounter.it.enabled",matches="true")
class AdminPatientHistoryPostgresTest {
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired AdminPatientHistoryService service;@Autowired JdbcTemplate jdbc;@Autowired EncounterDb db;@Autowired PlatformTransactionManager manager;
 @MockBean IamAuthorizationClient iam;
 UUID clinic=UUID.randomUUID(),branch=UUID.randomUUID(),patient=UUID.randomUUID(),point=UUID.randomUUID();Actor actor=new Actor(UUID.randomUUID(),Set.of("ROLE_PATIENT"));
 @BeforeEach void fixture(){when(iam.decide(any(),eq("CLINIC_CONFIG"),any(),isNull())).thenReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"ADMIN",1,"SYNTHETIC"));
  new TransactionTemplate(manager).executeWithoutResult(t->{db.scope(clinic,branch);jdbc.update("insert into encounter_v2.service_points(id,clinic_id,branch_id,code,name) values(?,?,?,'SYN','Synthetic')",point,clinic,branch);
   for(String state:List.of("WAITING","CANCELLED"))jdbc.update("insert into encounter_v2.visits(id,clinic_id,branch_id,patient_id,clinic_patient_link_id,doctor_id,doctor_user_id,service_point_id,status) values(?,?,?,?,?,?,?,?,?)",UUID.randomUUID(),clinic,branch,patient,UUID.randomUUID(),UUID.randomUUID(),UUID.randomUUID(),point,state);
   jdbc.update("insert into encounter_v2.visits(id,clinic_id,branch_id,patient_id,clinic_patient_link_id,doctor_id,doctor_user_id,service_point_id,status) values(?,?,?,?,?,?,?,?,'WAITING')",UUID.randomUUID(),clinic,branch,UUID.randomUUID(),UUID.randomUUID(),UUID.randomUUID(),UUID.randomUUID(),point);
  });
 }
 @Test void paginatesOnlyActualPatientVisitsIncludingWalkInsWithoutMedicalNotes(){
  var page=service.list(actor,clinic,branch,patient,0,1);assertEquals(2,page.totalElements());assertEquals(2,page.totalPages());assertTrue(page.content().getFirst().walkIn());assertNotEquals(page.content().getFirst().encounterId(),service.list(actor,clinic,branch,patient,1,1).content().getFirst().encounterId());
  assertEquals(0,service.list(actor,UUID.randomUUID(),branch,patient,0,20).totalElements());assertEquals(0,service.list(actor,clinic,UUID.randomUUID(),patient,0,20).totalElements());assertEquals(0,service.list(actor,clinic,branch,UUID.randomUUID(),0,20).totalElements());assertEquals(0,jdbc.queryForObject("select count(*) from encounter_v2.visits",Integer.class));
 }
 @Test void rejectsRevokedOrNonAdminGrantAndInvalidPagination(){
  assertThrows(ApiProblem.class,()->service.list(actor,clinic,branch,patient,-1,20));when(iam.decide(any(),eq("CLINIC_CONFIG"),any(),isNull())).thenReturn(new IamAuthorizationClient.Decision(false,null,null,2,"REVOKED"));assertThrows(ApiProblem.class,()->service.list(actor,clinic,branch,patient,0,20));
  when(iam.decide(any(),eq("CLINIC_CONFIG"),any(),isNull())).thenReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"DOCTOR",1,"SYNTHETIC"));assertThrows(ApiProblem.class,()->service.list(actor,clinic,branch,patient,0,20));
 }
}
