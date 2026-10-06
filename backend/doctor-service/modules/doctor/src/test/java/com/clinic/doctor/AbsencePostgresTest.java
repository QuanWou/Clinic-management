package com.clinic.doctor;
import com.clinic.doctor.api.ApiProblem;
import com.clinic.doctor.security.*;
import com.clinic.doctor.service.AbsenceService;
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
import java.time.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
@SpringBootTest(properties={"doctor.security.iam-service-secret=synthetic-doctor-iam-secret-at-least-32-bytes","doctor.security.clinic-service-secret=synthetic-doctor-clinic-secret-at-least-32-bytes"})
@EnabledIfSystemProperty(named="doctor.it.enabled",matches="true")
class AbsencePostgresTest {
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired AbsenceService service;@Autowired JdbcTemplate jdbc;@Autowired TenantDbContext db;@Autowired PlatformTransactionManager manager;
 @MockBean IamAuthorizationClient iam;@MockBean ClinicDirectoryClient clinics;
 UUID clinic,branch,doctor;Actor managerActor;
 @BeforeEach void fixture(){clinic=UUID.randomUUID();branch=UUID.randomUUID();doctor=UUID.randomUUID();managerActor=new Actor(UUID.randomUUID(),Set.of("ROLE_USER"));when(iam.decide(any(),anyString(),any(),any())).thenReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"ADMIN",1,"SYN"));new TransactionTemplate(manager).execute(s->{db.tenant(clinic);jdbc.update("insert into doctor.practitioners(id,platform_user_id,display_name) values(?,?,?)",doctor,UUID.randomUUID(),"Synthetic Doctor");jdbc.update("insert into doctor.doctor_affiliations(id,practitioner_id,clinic_id,branch_id,specialty_code,specialty_name,effective_from) values(?,?,?,?,?,?,current_date)",UUID.randomUUID(),doctor,clinic,branch,"GEN","Synthetic");return null;});}
 @Test void concurrentReportsReplayOneScopedIntervalWithNonPrivatePublicWindow()throws Exception{
  var start=Instant.now().plusSeconds(60);var end=start.plusSeconds(3600);var input=new AbsenceService.Input(start,end,"Synthetic private absence reason");var pool=Executors.newFixedThreadPool(2);var barrier=new CyclicBarrier(2);
  try{var a=pool.submit(()->{barrier.await();return service.report(managerActor,clinic,branch,doctor,"same",input);});var b=pool.submit(()->{barrier.await();return service.report(managerActor,clinic,branch,doctor,"same",input);});assertEquals(a.get(20,TimeUnit.SECONDS).id(),b.get(20,TimeUnit.SECONDS).id());}finally{pool.shutdownNow();}
  assertEquals(1,service.list(managerActor,clinic,branch,doctor).size());assertEquals(1,service.windows(clinic,branch,doctor).size());assertThrows(ApiProblem.class,()->service.requirePresent(clinic,branch,doctor,start));service.requirePresent(clinic,branch,doctor,end);
  assertThrows(ApiProblem.class,()->service.report(managerActor,clinic,branch,doctor,"same",new AbsenceService.Input(start,end,"Changed")));assertTrue(service.windows(UUID.randomUUID(),branch,doctor).isEmpty());assertTrue(service.windows(clinic,UUID.randomUUID(),doctor).isEmpty());assertEquals(0,jdbc.queryForObject("select count(*) from doctor.absences",Integer.class));
 }
 @Test void revokeInvalidRangesAndWrongBranchDoNotWriteAbsence(){
  var start=Instant.now();assertThrows(ApiProblem.class,()->service.report(managerActor,clinic,branch,doctor,"range",new AbsenceService.Input(start,start.plus(Duration.ofDays(32)),"Synthetic")));assertThrows(ApiProblem.class,()->service.report(managerActor,clinic,UUID.randomUUID(),doctor,"branch",new AbsenceService.Input(start,start.plusSeconds(60),"Synthetic")));
  when(iam.decide(eq(managerActor.id()),eq("CLINIC_CONFIG"),eq(clinic),eq(branch))).thenReturn(new IamAuthorizationClient.Decision(false,null,null,2,"REVOKED"));assertThrows(ApiProblem.class,()->service.report(managerActor,clinic,branch,doctor,"revoke",new AbsenceService.Input(start,start.plusSeconds(60),"Synthetic")));assertTrue(service.list(managerActor,clinic,branch,doctor).isEmpty());
 }
 @Test void concurrentCancellationPreservesIntervalAndOneReceiptAndRechecksRevoke()throws Exception{
  Instant start=Instant.now().plusSeconds(60),end=start.plusSeconds(3600);var original=service.report(managerActor,clinic,branch,doctor,"cancel-source",new AbsenceService.Input(start,end,"Synthetic original"));var input=new AbsenceService.CancelInput(1,"Synthetic cancellation");
  var pool=Executors.newFixedThreadPool(4);try{var pending=new ArrayList<Future<AbsenceService.Change>>();for(int n=0;n<8;n++)pending.add(pool.submit(()->service.cancel(managerActor,clinic,branch,doctor,original.id(),"same-cancel",input)));for(var f:pending){var result=f.get(20,TimeUnit.SECONDS);assertEquals("CANCELLED",result.previous().state());assertEquals(2,result.previous().version());assertEquals(original.startsAt(),result.previous().startsAt());assertNull(result.replacement());}}finally{pool.shutdownNow();}
  assertTrue(service.windows(clinic,branch,doctor).isEmpty());service.requirePresent(clinic,branch,doctor,start);
  new TransactionTemplate(manager).execute(s->{db.tenant(clinic);assertEquals(1,jdbc.queryForObject("select count(*) from doctor.absence_commands where absence_id=?",Integer.class,original.id()));assertEquals(2,jdbc.queryForObject("select count(*) from doctor.absence_deliveries where absence_id=?",Integer.class,original.id()));return null;});
  assertThrows(ApiProblem.class,()->service.cancel(managerActor,clinic,branch,doctor,original.id(),"same-cancel",new AbsenceService.CancelInput(1,"Changed")));
  when(iam.decide(eq(managerActor.id()),eq("CLINIC_CONFIG"),eq(clinic),eq(branch))).thenReturn(new IamAuthorizationClient.Decision(false,null,null,2,"REVOKED"));assertThrows(ApiProblem.class,()->service.cancel(managerActor,clinic,branch,doctor,original.id(),"same-cancel",input));
 }
 @Test void amendmentAppendsNewIntervalAndRejectsStaleOrCrossBranch(){
  Instant start=Instant.now().plusSeconds(60),end=start.plusSeconds(3600);var original=service.report(managerActor,clinic,branch,doctor,"amend-source",new AbsenceService.Input(start,end,"Original"));var input=new AbsenceService.AmendInput(1,start.plusSeconds(7200),end.plusSeconds(7200),"Synthetic amended window");var change=service.amend(managerActor,clinic,branch,doctor,original.id(),"amend",input);
  assertEquals("CANCELLED",change.previous().state());assertEquals(original.startsAt(),change.previous().startsAt());assertEquals("ACTIVE",change.replacement().state());assertNotEquals(original.id(),change.replacement().id());assertEquals(change.replacement().id(),service.amend(managerActor,clinic,branch,doctor,original.id(),"amend",input).replacement().id());assertEquals(1,service.windows(clinic,branch,doctor).size());
  assertThrows(ApiProblem.class,()->service.cancel(managerActor,clinic,branch,doctor,original.id(),"stale",new AbsenceService.CancelInput(1,"Stale")));assertThrows(ApiProblem.class,()->service.cancel(managerActor,clinic,UUID.randomUUID(),doctor,change.replacement().id(),"branch",new AbsenceService.CancelInput(1,"Wrong branch")));
  assertThrows(org.springframework.dao.DataAccessException.class,()->new TransactionTemplate(manager).execute(s->{db.tenant(clinic);jdbc.update("update doctor.absences set starts_at=starts_at+interval '1 hour' where id=?",change.replacement().id());return null;}));
  assertThrows(org.springframework.dao.DataAccessException.class,()->new TransactionTemplate(manager).execute(s->{db.tenant(clinic);jdbc.update("update doctor.absences set state='ACTIVE',row_version=3,cancelled_at=null,cancelled_by=null where id=?",original.id());return null;}));
 }
}
