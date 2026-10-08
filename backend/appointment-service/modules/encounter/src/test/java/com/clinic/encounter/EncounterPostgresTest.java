package com.clinic.encounter;
import com.clinic.encounter.api.*;
import com.clinic.encounter.api.EncounterDto.*;
import com.clinic.encounter.security.*;
import com.clinic.encounter.service.*;
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
import java.time.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
@SpringBootTest(properties={"encounter.security.iam-service-secret=synthetic-encounter-iam-secret-at-least-32-bytes","encounter.security.clinic-service-secret=synthetic-encounter-clinic-secret-at-least-32-bytes","encounter.security.service-secret=synthetic-encounter-outbound-secret-at-least-32-bytes","encounter.security.billing-secret=synthetic-source-proof-secret-at-least-32-bytes"})
@EnabledIfSystemProperty(named="encounter.it.enabled",matches="true")
class EncounterPostgresTest {
 @Autowired com.clinic.encounter.api.ClinicalAccessAuditAdvice accessAudit;
 @Test void deniedClinicalAuditSurvivesOuterRollbackOmitsBodyAndRequiresAuthenticatedActor(){
  var request=new org.springframework.mock.web.MockHttpServletRequest("GET","/api/clinics/"+clinicId+"/branches/"+branchId+"/doctor/visits/"+appointmentId);
  var response=new org.springframework.mock.web.MockHttpServletResponse();response.setStatus(403);var body=Map.of("diagnosis","Synthetic confidential clinical text");
  org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(org.springframework.security.authentication.UsernamePasswordAuthenticationToken.authenticated(doctor,null,List.of()));
  try{
   new TransactionTemplate(manager).executeWithoutResult(t->{accessAudit.beforeBodyWrite(body,null,org.springframework.http.MediaType.APPLICATION_JSON,null,new org.springframework.http.server.ServletServerHttpRequest(request),new org.springframework.http.server.ServletServerHttpResponse(response));t.setRollbackOnly();});
   new TransactionTemplate(manager).executeWithoutResult(t->{db.scope(clinicId,branchId);String payload=jdbc.queryForObject("select payload_json from encounter_v2.outbox_events where event_type='clinic.encounter.access_recorded.v1'",String.class);assertTrue(payload.contains("DENIED"));assertTrue(payload.contains(doctor.id().toString()));assertTrue(payload.contains(appointmentId.toString()));assertFalse(payload.contains("diagnosis"));assertFalse(payload.contains("confidential"));});
   assertEquals(0,jdbc.queryForObject("select count(*) from encounter_v2.outbox_events",Integer.class));
   org.springframework.security.core.context.SecurityContextHolder.clearContext();
   assertSame(body,accessAudit.beforeBodyWrite(body,null,org.springframework.http.MediaType.APPLICATION_JSON,null,new org.springframework.http.server.ServletServerHttpRequest(request),new org.springframework.http.server.ServletServerHttpResponse(response)));
   assertEquals(1,count("outbox_events"));
  }finally{org.springframework.security.core.context.SecurityContextHolder.clearContext();}
 }
 @Autowired ChargeDeliveryOperations chargeOperations;
 @Test void managerRecoversAnotherStaffPendingReceiptWithOneConcurrentVisitAndAudit()throws Exception{
  when(sources.claim(eq(clinicId),eq(branchId),eq(appointmentId),eq(patientId),any(),any(),anyLong())).thenThrow(ApiProblem.dependency("Synthetic lost claim response"));assertThrows(ApiProblem.class,()->service.checkIn(receptionist,clinicId,branchId,appointmentId,"original",new CheckInInput(patientId,point,"Synthetic intake")));
  var pending=service.arrivals(receptionist,clinicId,branchId,LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"))).getFirst().visit();var input=new QueueInput(pending.version(),"Synthetic manager checks source after staff handoff",null);assertThrows(ApiProblem.class,()->service.superviseArrival(receptionist,clinicId,branchId,pending.id(),"manager-retry",input));
  Actor managerActor=new Actor(UUID.randomUUID(),Set.of());when(iam.decide(managerActor.id(),"RECEPTION",clinicId,branchId)).thenReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"ADMIN",1,"Granted"));assertEquals(pending.id(),service.pending(managerActor,clinicId,branchId,null,1).items().getFirst().id());
  doAnswer(i->{assertFalse(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive());return new EncounterSources.Booking(appointmentId,clinicId,branchId,patientId,linkId,doctorId,"CHECKED_IN",Instant.now(),1,i.getArgument(4));}).when(sources).claim(eq(clinicId),eq(branchId),eq(appointmentId),eq(patientId),any(),any(),anyLong());
  var pool=Executors.newFixedThreadPool(4);try{var futures=new ArrayList<Future<VisitView>>();for(int n=0;n<8;n++)futures.add(pool.submit(()->service.superviseArrival(managerActor,clinicId,branchId,pending.id(),"manager-retry",input)));for(var future:futures){var result=future.get(20,TimeUnit.SECONDS);assertEquals(pending.id(),result.id());assertEquals("WAITING",result.status());}}finally{pool.shutdownNow();}
  assertEquals(1,count("visits"));assertEquals(1,count("check_ins"));assertEquals(1,count("queue_tickets"));assertTrue(service.pending(managerActor,clinicId,branchId,null,25).items().isEmpty());assertThrows(ApiProblem.class,()->service.superviseArrival(managerActor,clinicId,branchId,pending.id(),"manager-retry",new QueueInput(input.expectedVersion(),"Changed",null)));
  new TransactionTemplate(manager).execute(s->{db.scope(clinicId,branchId);assertEquals(1,jdbc.queryForObject("select count(*) from encounter_v2.outbox_events where event_type='clinic.encounter.arrival_recovered.v1'",Integer.class));assertEquals(managerActor.id(),jdbc.queryForObject("select actor_user_id from encounter_v2.check_ins",UUID.class));return null;});when(iam.decide(managerActor.id(),"RECEPTION",clinicId,branchId)).thenReturn(new IamAuthorizationClient.Decision(false,null,null,2,"Revoked"));assertThrows(ApiProblem.class,()->service.superviseArrival(managerActor,clinicId,branchId,pending.id(),"manager-retry",input));
 }
 @Test void waitingVisitRollsForwardWithoutNewEncounterOrCheckInAndReplaySurvivesSourceOutage(){
  var original=visit("overnight-waiting");LocalDate yesterday=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).minusDays(1);new TransactionTemplate(manager).execute(s->{db.scope(clinicId,branchId);jdbc.update("update encounter_v2.queue_tickets set queue_date=? where id=?",yesterday,original.ticket().id());return null;});var input=new QueueInput(original.ticket().version(),"Synthetic patient returned today",point);var renewed=service.rollForward(receptionist,clinicId,branchId,original.ticket().id(),"roll",input);assertNotEquals(original.ticket().id(),renewed.id());assertEquals(original.id(),renewed.visitId());assertEquals(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")),renewed.date());assertEquals(1,count("visits"));assertEquals(1,count("check_ins"));assertEquals(2,count("queue_tickets"));
  when(sources.doctor(clinicId,branchId,doctorId)).thenThrow(ApiProblem.dependency("Later Doctor unavailable"));assertEquals(renewed.id(),service.rollForward(receptionist,clinicId,branchId,original.ticket().id(),"roll",input).id());assertThrows(ApiProblem.class,()->service.rollForward(receptionist,clinicId,branchId,original.ticket().id(),"roll",new QueueInput(input.expectedVersion(),"Changed",point)));
 }
 @Test void queueKeysetPagesKeepPriorityAndRejectOutOfScopeOrInvalidSize(){
  for(int n=0;n<7;n++)visit("page-"+n);LocalDate today=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));var first=service.queuePage(receptionist,clinicId,branchId,point,today,0,3);assertEquals(3,first.items().size());assertEquals(3,first.nextAfterNumber());var second=service.queuePage(receptionist,clinicId,branchId,point,today,first.nextAfterNumber(),3);assertEquals(4,second.items().getFirst().number());assertEquals(6,second.nextAfterNumber());var last=service.queuePage(receptionist,clinicId,branchId,point,today,second.nextAfterNumber(),3);assertEquals(1,last.items().size());assertNull(last.nextAfterNumber());
  assertThrows(ApiProblem.class,()->service.move(receptionist,clinicId,branchId,second.items().getFirst().id(),"call",new QueueInput(0,"Cannot skip earlier page priority",null)));assertThrows(ApiProblem.class,()->service.queuePage(receptionist,clinicId,branchId,point,today,0,101));assertThrows(ApiProblem.class,()->service.queuePage(receptionist,clinicId,UUID.randomUUID(),point,today,0,3));
 }
 @Test void exceptionResolutionRequiresCanonicalManagerAndReplayStillRechecksRevocation(){
  UUID exception=UUID.randomUUID();var in=new EncounterService.ResolutionInput(7,"Synthetic resolved source");when(iam.decide(receptionist.id(),"CLINIC_CONFIG",clinicId,branchId)).thenReturn(new IamAuthorizationClient.Decision(false,null,null,1,"Reception cannot resolve"));assertThrows(ApiProblem.class,()->service.resolve(receptionist,clinicId,branchId,appointmentId,exception,"same",in));verify(sources,never()).resolve(any(),any(),any(),any(),anyString(),any());
  when(iam.decide(receptionist.id(),"CLINIC_CONFIG",clinicId,branchId)).thenReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"ADMIN",2,"Granted"));var proof=new EncounterSources.ExceptionView(exception,appointmentId,"DOCTOR_ABSENT","RESOLVED","IN_APP");when(sources.resolve(eq(clinicId),eq(branchId),eq(appointmentId),eq(exception),eq("same"),any())).thenReturn(proof);assertEquals(proof,service.resolve(receptionist,clinicId,branchId,appointmentId,exception,"same",in));verify(sources).resolve(clinicId,branchId,appointmentId,exception,"same",new EncounterSources.ResolutionInput(receptionist.id(),7,in.reason()));
  when(iam.decide(receptionist.id(),"CLINIC_CONFIG",clinicId,branchId)).thenReturn(new IamAuthorizationClient.Decision(false,null,null,3,"Revoked"));assertThrows(ApiProblem.class,()->service.resolve(receptionist,clinicId,branchId,appointmentId,exception,"same",in));
 }
 @Test void completedVisitBillingRecoveryKeepsOriginalVisitAndSingleAuditEffect()throws Exception{
  var v=beginCare("billing-recovery");when(medical.read(doctor,clinicId,branchId,v.id())).thenReturn(new MedicalReadinessClient.Proof(v.id(),clinicId,branchId,2,"VALIDATED",true));var completed=service.complete(doctor,clinicId,branchId,v.id(),"complete",new CompletionInput(v.version(),2,"Unsigned completion",true));
  UUID event=new TransactionTemplate(manager).execute(t->{db.scope(clinicId,branchId);jdbc.update("update encounter_v2.billing_deliveries set status='DLQ',attempts=8,last_error='BILLING_INBOX_DELIVERY_FAILURE'");return jdbc.queryForObject("select event_id from encounter_v2.billing_deliveries",UUID.class);});
  assertThrows(ApiProblem.class,()->chargeOperations.retry(receptionist,clinicId,branchId,v.id(),event,"retry","Investigated delivery"));
  var owner=new Actor(UUID.randomUUID(),Set.of());doReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"ADMIN",1,"Granted")).when(iam).decide(owner.id(),"BILLING",clinicId,branchId);
  assertEquals("PENDING",chargeOperations.retry(owner,clinicId,branchId,v.id(),event,"retry","Investigated delivery").events().getFirst().status());assertEquals("PENDING",chargeOperations.retry(owner,clinicId,branchId,v.id(),event,"retry","Investigated delivery").events().getFirst().status());assertEquals(1,count("charge_recovery_commands"));assertThrows(ApiProblem.class,()->chargeOperations.retry(owner,clinicId,branchId,v.id(),event,"retry","Changed"));assertThrows(ApiProblem.class,()->chargeOperations.retry(owner,clinicId,branchId,v.id(),event,"new-key","Already pending"));
  var source=service.read(receptionist,clinicId,branchId,v.id());assertEquals(completed.status(),source.status());assertEquals(completed.version(),source.version());assertNull(completed.ticket());assertNull(source.ticket());new TransactionTemplate(manager).execute(t->{db.scope(clinicId,branchId);assertEquals(1,jdbc.queryForObject("select count(*) from encounter_v2.outbox_events where event_type='clinic.encounter.billing_retry_requested.v1'",Integer.class));jdbc.update("update encounter_v2.billing_deliveries set status='PUBLISHED'");return null;});assertEquals("PUBLISHED",chargeOperations.retry(owner,clinicId,branchId,v.id(),event,"retry","Investigated delivery").events().getFirst().status());
  UUID other=UUID.randomUUID();doReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"ADMIN",1,"Other branch")).when(iam).decide(owner.id(),"BILLING",clinicId,other);assertTrue(chargeOperations.read(owner,clinicId,other,v.id()).events().isEmpty());assertThrows(ApiProblem.class,()->chargeOperations.retry(owner,clinicId,other,v.id(),event,"wrong","Wrong branch"));doReturn(new IamAuthorizationClient.Decision(false,null,null,2,"Revoked")).when(iam).decide(owner.id(),"BILLING",clinicId,branchId);assertThrows(ApiProblem.class,()->chargeOperations.read(owner,clinicId,branchId,v.id()));
 }
 @Autowired com.clinic.encounter.api.BillingProofController billingProof;
 String billingToken(String scope){var now=Instant.now();return "Bearer "+io.jsonwebtoken.Jwts.builder().issuer("billing-service").subject("billing-service").audience().add("encounter-service").and().id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",List.of(scope)).issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(30))).signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor("synthetic-source-proof-secret-at-least-32-bytes".getBytes(java.nio.charset.StandardCharsets.UTF_8))).compact();}
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired EncounterService service;@Autowired JdbcTemplate jdbc;@Autowired EncounterDb db;@Autowired PlatformTransactionManager manager;@Autowired ObjectMapper json;
 @MockBean EncounterSources sources;@MockBean IamAuthorizationClient iam;@MockBean ClinicDirectoryClient clinic;@MockBean MedicalReadinessClient medical;
 @MockBean PatientOwnershipClient patientOwner;@Autowired PatientFollowUpController patientFollowUp;@Autowired OperationsSummaryController operations;
 UUID offeringId=UUID.randomUUID();
 UUID clinicId,branchId,patientId,linkId,doctorId,doctorUser,point,appointmentId;Actor receptionist,doctor;
 @Test void doctorPagesPastTwoHundredWithoutTimestampTiesOrInactiveCursorLosingRows(){
  new TransactionTemplate(manager).execute(t->{db.scope(clinicId,branchId);for(int n=1;n<=225;n++)jdbc.update("insert into encounter_v2.visits(id,clinic_id,branch_id,patient_id,clinic_patient_link_id,doctor_id,doctor_user_id,service_point_id,status,created_at) values(?,?,?,?,?,?,?,?,?,?)",new UUID(0,n),clinicId,branchId,patientId,linkId,doctorId,doctorUser,point,"WAITING",java.sql.Timestamp.from(Instant.parse("2026-10-02T00:00:00Z")));return null;});
  var first=service.worklistPage(doctor,clinicId,branchId,null,200);assertEquals(200,first.items().size());assertEquals(new UUID(0,200),first.nextAfter());assertEquals(first.items(),service.worklist(doctor,clinicId,branchId));
  new TransactionTemplate(manager).execute(t->{db.scope(clinicId,branchId);jdbc.update("update encounter_v2.visits set status='INTERRUPTED' where id=?",first.nextAfter());return null;});
  var last=service.worklistPage(doctor,clinicId,branchId,first.nextAfter(),200);assertEquals(25,last.items().size());assertEquals(new UUID(0,201),last.items().getFirst().id());assertEquals(new UUID(0,225),last.items().getLast().id());assertNull(last.nextAfter());
  var all=new HashSet<UUID>();first.items().forEach(v->assertTrue(all.add(v.id())));last.items().forEach(v->assertTrue(all.add(v.id())));assertEquals(225,all.size());
 }
 @Test void doctorPageRechecksRoleScopeCursorOwnershipAndRevocation(){
  var own=visit("page-own");var other=new Actor(UUID.randomUUID(),Set.of("ROLE_DOCTOR"));
  assertTrue(service.worklistPage(other,clinicId,branchId,null,20).items().isEmpty());
  assertThrows(ApiProblem.class,()->service.worklistPage(other,clinicId,branchId,own.id(),20));assertThrows(ApiProblem.class,()->service.worklistPage(doctor,clinicId,UUID.randomUUID(),own.id(),20));
  assertThrows(ApiProblem.class,()->service.worklistPage(doctor,clinicId,branchId,null,201));assertThrows(ApiProblem.class,()->service.worklistPage(doctor,clinicId,branchId,null,0));
  when(iam.decide(receptionist.id(),"DOCTOR_WORK",clinicId,branchId)).thenReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"STAFF",1,"Wrong role"));assertThrows(ApiProblem.class,()->service.worklistPage(receptionist,clinicId,branchId,null,20));
  when(iam.decide(doctor.id(),"DOCTOR_WORK",clinicId,branchId)).thenReturn(new IamAuthorizationClient.Decision(false,null,null,2,"Revoked"));assertThrows(ApiProblem.class,()->service.worklistPage(doctor,clinicId,branchId,own.id(),20));
 }
 @BeforeEach void fixture(){clinicId=UUID.randomUUID();branchId=UUID.randomUUID();patientId=UUID.randomUUID();linkId=UUID.randomUUID();doctorId=UUID.randomUUID();doctorUser=UUID.randomUUID();appointmentId=UUID.randomUUID();receptionist=new Actor(UUID.randomUUID(),Set.of("ROLE_RECEPTIONIST"));doctor=new Actor(doctorUser,Set.of("ROLE_DOCTOR"));
  when(iam.decide(any(),anyString(),any(),any())).thenAnswer(i->new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"DOCTOR_WORK".equals(i.getArgument(1))?"DOCTOR":"STAFF",1,"SYNTHETIC"));
  when(sources.consultation(eq(receptionist),eq(clinicId),eq(branchId),eq(offeringId))).thenReturn(new Consultation(offeringId,"Khám tổng quát",new PriceSnapshot(UUID.randomUUID(),180000,"VND",Instant.now().minusSeconds(60),null,null)));
  when(sources.identities(eq(clinicId),anyList())).thenAnswer(i->{assertFalse(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive());return List.of(new PatientSummary(patientId,"PT-SYN","Synthetic Patient",LocalDate.of(1990,1,1)));});
  when(sources.patient(clinicId,patientId)).thenReturn(new EncounterSources.PatientLink(linkId,clinicId,patientId,"PROVISIONAL"));
  when(sources.receptionCandidates(any(),eq(clinicId),eq(branchId),eq(offeringId))).thenAnswer(i->List.of(new EncounterSources.DoctorAssignment(doctorId,clinicId,branchId,doctorUser)));
  when(sources.doctor(clinicId,branchId,doctorId)).thenReturn(new EncounterSources.DoctorAssignment(doctorId,clinicId,branchId,doctorUser));
  when(sources.booking(clinicId,branchId,appointmentId)).thenReturn(new EncounterSources.Booking(appointmentId,clinicId,branchId,patientId,linkId,doctorId,"CONFIRMED",Instant.now(),0,null));
  when(sources.claim(eq(clinicId),eq(branchId),eq(appointmentId),eq(patientId),any(),any(),anyLong())).thenAnswer(i->new EncounterSources.Booking(appointmentId,clinicId,branchId,patientId,linkId,doctorId,"CHECKED_IN",Instant.now(),1,i.getArgument(4)));
  point=service.point(receptionist,clinicId,branchId,new PointInput("R1","Synthetic Room")).id();
 }
 @Test void successfulArrivalAcknowledgementWinsOverAStalePreChangeDoctorSnapshot(){
  UUID replacement=UUID.randomUUID(),replacementUser=UUID.randomUUID();
  when(sources.doctor(clinicId,branchId,replacement)).thenReturn(new EncounterSources.DoctorAssignment(replacement,clinicId,branchId,replacementUser));
  when(sources.claim(eq(clinicId),eq(branchId),eq(appointmentId),eq(patientId),any(),any(),anyLong())).thenAnswer(i->new EncounterSources.Booking(appointmentId,clinicId,branchId,patientId,linkId,replacement,"CHECKED_IN",Instant.now(),2,i.getArgument(4)));
  var v=service.checkIn(receptionist,clinicId,branchId,appointmentId,"concurrent-prechange",new CheckInInput(patientId,point,"Patient changed doctor before source arrival claim"));
  assertEquals(replacement,v.doctorId());assertEquals(replacement,v.ticket().doctorId());assertEquals("WAITING",v.status());assertEquals(1,count("visits"));assertEquals(1,count("check_ins"));assertEquals(1,count("queue_tickets"));
 }
 @Test void operationsCountsOwnedCurrentExceptionsAndDailyEventsWithoutRevealingPatients()throws Exception{
  var date=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));var v=visit("operational");
  new TransactionTemplate(manager).execute(t->{db.scope(clinicId,branchId);jdbc.update("update encounter_v2.visits set created_at=?,checked_in_at=?,status='AWAITING_RESULTS' where id=?",java.sql.Timestamp.from(date.minusDays(1).atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant()),java.sql.Timestamp.from(date.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).plusHours(8).toInstant()),v.id());return null;});
  assertThrows(ApiProblem.class,()->operations.read(receptionist,clinicId,branchId,date));
  when(iam.decide(receptionist.id(),"RECEPTION",clinicId,branchId)).thenReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"ADMIN",1,"Synthetic"));
  var report=operations.read(receptionist,clinicId,branchId,date);assertEquals(1,report.checkedIn());assertEquals(0,report.completed());assertEquals(1,report.openVisits());assertEquals(1,report.overnight());assertEquals(1,report.awaitingResults());assertEquals(1,report.waitingTickets());
  assertEquals(0,operations.read(receptionist,clinicId,branchId,date.plusDays(1)).checkedIn());
  String payload=json.writeValueAsString(report);assertFalse(payload.contains(patientId.toString()));assertFalse(payload.contains("Synthetic PHI"));assertFalse(payload.contains("patientId"));
  UUID otherBranch=UUID.randomUUID();when(iam.decide(receptionist.id(),"RECEPTION",clinicId,otherBranch)).thenReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"ADMIN",1,"Synthetic branch grant"));
  assertEquals(0,operations.read(receptionist,clinicId,otherBranch,date).openVisits());
  when(iam.decide(receptionist.id(),"RECEPTION",clinicId,branchId)).thenReturn(new IamAuthorizationClient.Decision(false,null,null,2,"Revoked"));
  assertThrows(ApiProblem.class,()->operations.read(receptionist,clinicId,branchId,date));assertEquals(0,jdbc.queryForObject("select count(*) from encounter_v2.visits",Integer.class));
 }
 @Test void billingSystemProofRequiresCompletedVisitAndDedicatedPeerScope(){
  var v=beginCare("billing-source");final var active=v;assertThrows(ApiProblem.class,()->billingProof.systemProof(billingToken("billing.source.sync"),clinicId,branchId,active.id()));when(medical.read(doctor,clinicId,branchId,v.id())).thenReturn(new MedicalReadinessClient.Proof(v.id(),clinicId,branchId,8,"VALIDATED",true));v=service.complete(doctor,clinicId,branchId,v.id(),"complete",new CompletionInput(v.version(),8,"Complete once",true));final var completed=v;
  assertThrows(ApiProblem.class,()->billingProof.systemProof(billingToken("billing.source.read"),clinicId,branchId,completed.id()));assertThrows(ApiProblem.class,()->billingProof.systemProof("Bearer invalid",clinicId,branchId,completed.id()));assertThrows(ApiProblem.class,()->billingProof.systemProof(billingToken("billing.source.sync"),clinicId,UUID.randomUUID(),completed.id()));
  var proof=billingProof.systemProof(billingToken("billing.source.sync"),clinicId,branchId,completed.id());assertEquals(patientId,proof.patientId());assertEquals(8,proof.medicalCaseVersion());assertEquals(1,count("billing_deliveries"));
 }
 WalkInInput walk(){return new WalkInInput(patientId,doctorId,point,"Synthetic PHI reason stays local",offeringId);}
 VisitView visit(String key){return service.walkIn(receptionist,clinicId,branchId,key,walk());}
 int count(String table){return new TransactionTemplate(manager).execute(s->{db.scope(clinicId,branchId);return jdbc.queryForObject("select count(*) from encounter_v2."+table,Integer.class);});}
 @Test void patientFollowUpProofRequiresCompletedOwnedVisitAndVersion(){
  var v=beginCare("own-follow-up");var actor=new Actor(UUID.randomUUID(),Set.of("ROLE_USER"),"Bearer synthetic-patient");when(patientOwner.ownPatient(actor,clinicId)).thenAnswer(i->{assertFalse(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive());return patientId;});final var active=v;
  assertThrows(ApiProblem.class,()->patientFollowUp.proof(actor,clinicId,branchId,active.id()));when(medical.read(doctor,clinicId,branchId,v.id())).thenReturn(new MedicalReadinessClient.Proof(v.id(),clinicId,branchId,8,"VALIDATED",true));
  var completed=service.complete(doctor,clinicId,branchId,v.id(),"complete",new CompletionInput(v.version(),8,"Complete unsigned prior",true));var proof=patientFollowUp.proof(actor,clinicId,branchId,v.id());assertEquals(8,proof.medicalCaseVersion());assertEquals(patientId,proof.patientId());assertEquals("CLINICALLY_COMPLETED",proof.status());
  assertThrows(ApiProblem.class,()->patientFollowUp.proof(actor,clinicId,UUID.randomUUID(),active.id()));when(patientOwner.ownPatient(actor,clinicId)).thenReturn(UUID.randomUUID());assertThrows(ApiProblem.class,()->patientFollowUp.proof(actor,clinicId,branchId,active.id()));when(patientOwner.ownPatient(actor,clinicId)).thenThrow(ApiProblem.forbidden());assertThrows(ApiProblem.class,()->patientFollowUp.proof(actor,clinicId,branchId,active.id()));assertEquals(0,jdbc.queryForObject("select count(*) from encounter_v2.visits",Integer.class));
 }
 @Test void twentySameKeyWalkInsCreateOneVisitCheckInTicketAndEvent()throws Exception{
  var executor=Executors.newFixedThreadPool(8);var start=new CountDownLatch(1);List<Future<VisitView>> results=new ArrayList<>();
  try{for(int n=0;n<20;n++)results.add(executor.submit(()->{start.await();return visit("same-key");}));start.countDown();Set<UUID> ids=new HashSet<>();for(var f:results){var v=f.get(30,TimeUnit.SECONDS);ids.add(v.id());assertNull(v.appointmentId());assertEquals("WAITING",v.status());assertTrue(v.ticket().code().matches("R1-[0-9]{8}-0001"));}assertEquals(1,ids.size());assertEquals(1,count("visits"));assertEquals(1,count("check_ins"));assertEquals(1,count("queue_tickets"));assertEquals(1,count("outbox_events"));
  }finally{executor.shutdownNow();}
  assertThrows(ApiProblem.class,()->service.walkIn(receptionist,clinicId,branchId,"same-key",new WalkInInput(patientId,doctorId,point,"changed payload",offeringId)));
 }
 @Test void lostAppointmentClaimResponseLeavesNoTicketAndRetryResumesSameVisit(){
  doThrow(ApiProblem.dependency("Synthetic uncertain claim")).doAnswer(i->new EncounterSources.Booking(appointmentId,clinicId,branchId,patientId,linkId,doctorId,"CHECKED_IN",Instant.now(),1,i.getArgument(4))).when(sources).claim(eq(clinicId),eq(branchId),eq(appointmentId),eq(patientId),any(),any(),anyLong());
  var input=new CheckInInput(patientId,point,"Synthetic arrival");assertThrows(ApiProblem.class,()->service.checkIn(receptionist,clinicId,branchId,appointmentId,"check",input));assertEquals(1,count("visits"));assertEquals(0,count("queue_tickets"));assertEquals(0,count("check_ins"));
  var recovered=service.checkIn(receptionist,clinicId,branchId,appointmentId,"check",input);assertEquals("WAITING",recovered.status());assertEquals(recovered.id(),service.checkIn(receptionist,clinicId,branchId,appointmentId,"check",input).id());assertEquals(1,count("check_ins"));assertEquals(1,count("queue_tickets"));
 }
 @Test void concurrentDifferentCheckInKeysShareOneAppointmentVisitAndTicket()throws Exception{
  var executor=Executors.newFixedThreadPool(2);var barrier=new CyclicBarrier(2);var input=new CheckInInput(patientId,point,"Synthetic arrival");
  try{var a=executor.submit(()->{barrier.await();return service.checkIn(receptionist,clinicId,branchId,appointmentId,"one",input);});var b=executor.submit(()->{barrier.await();return service.checkIn(receptionist,clinicId,branchId,appointmentId,"two",input);});assertEquals(a.get(20,TimeUnit.SECONDS).id(),b.get(20,TimeUnit.SECONDS).id());assertEquals(1,count("check_ins"));assertEquals(1,count("queue_tickets"));}finally{executor.shutdownNow();}
 }
 @Test void autoRoutingChoosesLeastLoadedEligibleDoctorAndRejectsUnverifiedDoctor(){
  var existing=visit("occupied");UUID other=UUID.randomUUID(),otherUser=UUID.randomUUID(),newPatient=UUID.randomUUID();
  when(sources.patient(clinicId,newPatient)).thenReturn(new EncounterSources.PatientLink(UUID.randomUUID(),clinicId,newPatient,"VERIFIED"));
  when(sources.receptionCandidates(any(),eq(clinicId),eq(branchId),eq(offeringId))).thenReturn(List.of(new EncounterSources.DoctorAssignment(doctorId,clinicId,branchId,doctorUser),new EncounterSources.DoctorAssignment(other,clinicId,branchId,otherUser)));
  var routed=service.walkIn(receptionist,clinicId,branchId,"auto",new WalkInInput(newPatient,null,point,"Auto route verified service",offeringId));assertEquals(other,routed.doctorId());assertNull(routed.appointmentId());assertEquals("WAITING",routed.ticket().state());
  assertEquals(routed.id(),service.walkIn(receptionist,clinicId,branchId,"auto",new WalkInInput(newPatient,null,point,"Auto route verified service",offeringId)).id());
  assertThrows(ApiProblem.class,()->service.walkIn(receptionist,clinicId,branchId,"duplicate-patient",new WalkInInput(newPatient,null,point,"Duplicate should be rejected",offeringId)));
  when(sources.receptionCandidates(any(),eq(clinicId),eq(branchId),eq(offeringId))).thenReturn(List.of());
  var denied=assertThrows(ApiProblem.class,()->service.walkIn(receptionist,clinicId,branchId,"no-doctor",walk()));assertEquals("NO_ELIGIBLE_DOCTOR",denied.code);assertEquals(2,count("visits"));
 }
 @Test void sharedReceptionSeesBothCollectorsAndAdminRequestsAreAuditableAndReplaySafe(){
  var v=service.checkIn(receptionist,clinicId,branchId,appointmentId,"shared",new CheckInInput(patientId,point,"Online arrival"));
  var colleague=new Actor(UUID.randomUUID(),Set.of());var page=service.receptionWorkload(colleague,clinicId,branchId,LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")),null);assertEquals(v.id(),page.items().getFirst().visit().id());assertNotNull(page.items().getFirst().visit().patient());
  var body=new EncounterService.RequestInput(v.id(),patientId,"DOCTOR_CHANGE","Patient requested a doctor change after queue entry");var request=service.request(colleague,clinicId,branchId,"request",body);assertEquals(request.id(),service.request(colleague,clinicId,branchId,"request",body).id());assertEquals(1,service.requests(receptionist,clinicId,branchId).size());assertEquals(doctorId,service.read(receptionist,clinicId,branchId,v.id()).doctorId());
  assertThrows(ApiProblem.class,()->service.resolveRequest(colleague,clinicId,branchId,request.id(),"Staff cannot resolve"));assertEquals(1,count("reception_requests"));
  when(iam.decide(colleague.id(),"RECEPTION",clinicId,branchId)).thenReturn(new IamAuthorizationClient.Decision(false,null,null,2,"Revoked"));assertThrows(ApiProblem.class,()->service.requests(colleague,clinicId,branchId));assertThrows(ApiProblem.class,()->service.request(colleague,clinicId,branchId,"request",body));
 }
 @Test void recallAbsenceAndConcurrentReturnToEndHaveSingleOperationalEffects()throws Exception{
  var v=visit("absence");var called=service.move(receptionist,clinicId,branchId,v.ticket().id(),"call",new QueueInput(0,"Call",null),"call");
  var recalled=service.move(receptionist,clinicId,branchId,called.id(),"recall",new QueueInput(called.version(),"Recall",null),"recall");assertEquals("CALLED",recalled.state());
  var absent=service.move(receptionist,clinicId,branchId,recalled.id(),"absent",new QueueInput(recalled.version(),"Patient absent",null),"absent");assertEquals("ABSENT",absent.state());assertNull(service.read(receptionist,clinicId,branchId,v.id()).ticket());
  var body=new QueueInput(absent.version(),"Patient returned",null);var pool=Executors.newFixedThreadPool(4);try{var results=new ArrayList<Future<TicketView>>();for(int n=0;n<8;n++)results.add(pool.submit(()->service.move(receptionist,clinicId,branchId,absent.id(),"requeue",body,"return")));for(var f:results)assertEquals("TRANSFERRED",f.get(20,TimeUnit.SECONDS).state());}finally{pool.shutdownNow();}
  assertEquals(1,count("visits"));assertEquals(1,count("check_ins"));assertEquals(2,count("queue_tickets"));var returned=service.read(receptionist,clinicId,branchId,v.id()).ticket();assertEquals(2,returned.number());assertEquals("WAITING",returned.state());
  assertThrows(ApiProblem.class,()->service.move(receptionist,clinicId,branchId,absent.id(),"requeue",new QueueInput(absent.version(),"Changed request",null),"return"));
 }
 @Test void queueCallSkipTransferPreservesIdsAndAllowsOneActiveTicket(){
  var a=visit("one");var b=visit("two");var destination=service.point(receptionist,clinicId,branchId,new PointInput("R2","Synthetic other room")).id();
  assertThrows(ApiProblem.class,()->service.move(receptionist,clinicId,branchId,b.ticket().id(),"call",new QueueInput(0,"Synthetic call",null)));
  var called=service.move(receptionist,clinicId,branchId,a.ticket().id(),"call",new QueueInput(0,"Synthetic call",null));
  assertThrows(ApiProblem.class,()->service.move(receptionist,clinicId,branchId,b.ticket().id(),"call",new QueueInput(0,"Synthetic call",null)));
  var skipped=service.move(receptionist,clinicId,branchId,called.id(),"skip",new QueueInput(called.version(),"Synthetic skip",null));
  assertEquals(403,assertThrows(ApiProblem.class,()->service.move(receptionist,clinicId,branchId,skipped.id(),"transfer",new QueueInput(skipped.version(),"Staff denied",destination))).status.value());
  when(iam.decide(receptionist.id(),"RECEPTION",clinicId,branchId)).thenReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"ADMIN",1,"Admin transfer"));
  var moved=service.move(receptionist,clinicId,branchId,skipped.id(),"transfer",new QueueInput(skipped.version(),"Synthetic transfer",destination));assertEquals("TRANSFERRED",moved.state());assertEquals(a.id(),moved.visitId());
  var current=service.read(receptionist,clinicId,branchId,a.id());assertNotEquals(moved.id(),current.ticket().id());assertEquals(destination,current.ticket().servicePointId());
  assertEquals(1,service.queue(receptionist,clinicId,branchId,destination,LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"))).size());
 }
 @Test void differentDoctorsAtTheSameServicePointCanBeCalledIndependently(){
  var first=visit("doctor-one");UUID otherDoctorId=UUID.randomUUID(),otherDoctorUser=UUID.randomUUID();when(sources.doctor(clinicId,branchId,otherDoctorId)).thenReturn(new EncounterSources.DoctorAssignment(otherDoctorId,clinicId,branchId,otherDoctorUser));
  when(sources.receptionCandidates(any(),eq(clinicId),eq(branchId),eq(offeringId))).thenReturn(List.of(new EncounterSources.DoctorAssignment(doctorId,clinicId,branchId,doctorUser),new EncounterSources.DoctorAssignment(otherDoctorId,clinicId,branchId,otherDoctorUser)));
  var second=service.walkIn(receptionist,clinicId,branchId,"doctor-two",new WalkInInput(patientId,otherDoctorId,point,"Synthetic second doctor",offeringId));
  var calledFirst=service.move(receptionist,clinicId,branchId,first.ticket().id(),"call",new QueueInput(0,"Call doctor one",null));
  var calledSecond=service.move(receptionist,clinicId,branchId,second.ticket().id(),"call",new QueueInput(0,"Call doctor two",null));
  assertEquals("CALLED",calledFirst.state());assertEquals("CALLED",calledSecond.state());
 }
 @Test void assignedDoctorStartsOnlyCalledVisitAndCannotUseReceptionToken(){
  var v=visit("doctor");final var initial=v;assertThrows(ApiProblem.class,()->service.start(doctor,clinicId,branchId,initial.id(),new QueueInput(initial.version(),"Synthetic start",null)));
  service.move(receptionist,clinicId,branchId,v.ticket().id(),"call",new QueueInput(0,"Synthetic call",null));v=service.read(receptionist,clinicId,branchId,v.id());final var ready=v;
  assertThrows(ApiProblem.class,()->service.start(new Actor(UUID.randomUUID(),Set.of("ROLE_DOCTOR")),clinicId,branchId,ready.id(),new QueueInput(ready.version(),"Synthetic start",null)));
  assertTrue(service.worklist(new Actor(UUID.randomUUID(),Set.of("ROLE_DOCTOR")),clinicId,branchId).isEmpty());
  assertEquals("IN_PROGRESS",service.start(doctor,clinicId,branchId,v.id(),new QueueInput(v.version(),"Synthetic start",null)).status());
  assertThrows(ApiProblem.class,()->service.move(receptionist,clinicId,branchId,ready.ticket().id(),"skip",new QueueInput(ready.ticket().version()+1,"Synthetic skip",null)));
 }
 @Test void doctorCallCommandRespectsQueuePriorityAndOneActiveEncounterInvariant(){
  var first=visit("doctor-call-first");var second=visit("doctor-call-second");
  assertThrows(ApiProblem.class,()->service.care(doctor,clinicId,branchId,second.id(),"call","call-second-too-early",new CareInput(second.version(),"Cannot skip first patient",null)));
  var called=service.care(doctor,clinicId,branchId,first.id(),"call","call-first",new CareInput(first.version(),"Doctor calls first patient",null));assertEquals("CALLED",called.ticket().state());
  var active=service.care(doctor,clinicId,branchId,called.id(),"start","start-first",new CareInput(called.version(),"Begin first consultation",null));assertEquals("IN_PROGRESS",active.status());
  new TransactionTemplate(manager).execute(t->{db.scope(clinicId,branchId);UUID otherPoint=UUID.randomUUID();jdbc.update("insert into encounter_v2.service_points(id,clinic_id,branch_id,code,name) values(?,?,?,?,?)",otherPoint,clinicId,branchId,"G2","Second test point");jdbc.update("update encounter_v2.queue_tickets set service_point_id=?,state='CALLED',row_version=row_version+1 where id=?",otherPoint,second.ticket().id());jdbc.update("update encounter_v2.visits set service_point_id=?,row_version=row_version+1 where id=?",otherPoint,second.id());return null;});
  var forcedReady=service.read(receptionist,clinicId,branchId,second.id());assertThrows(ApiProblem.class,()->service.care(doctor,clinicId,branchId,forcedReady.id(),"start","blocked-second",new CareInput(forcedReady.version(),"Must not open two active encounters",null)));
  var waiting=service.care(doctor,clinicId,branchId,active.id(),"await-results","release-first",new CareInput(active.version(),"Await external result",null));assertEquals("AWAITING_RESULTS",waiting.status());
  var secondReady=service.read(receptionist,clinicId,branchId,second.id());assertEquals("IN_PROGRESS",service.care(doctor,clinicId,branchId,secondReady.id(),"start","start-second",new CareInput(secondReady.version(),"Begin second consultation after release",null)).status());
  assertEquals(1,new TransactionTemplate(manager).execute(t->{db.scope(clinicId,branchId);return jdbc.queryForObject("select count(*) from encounter_v2.visits where doctor_user_id=? and status='IN_PROGRESS'",Integer.class,doctor.id());}).intValue());
 }
 @Test void patientCompletedBatchOnlyReturnsOwnedClinicallyCompletedVisits(){
  var v=beginCare("patient-batch");var actor=new Actor(UUID.randomUUID(),Set.of("ROLE_USER"),"Bearer synthetic-patient");when(patientOwner.ownPatient(actor,clinicId)).thenReturn(patientId);
  assertTrue(patientFollowUp.completed(actor,clinicId,branchId,List.of(v.id())).isEmpty());
  when(medical.read(doctor,clinicId,branchId,v.id())).thenReturn(new MedicalReadinessClient.Proof(v.id(),clinicId,branchId,11,"VALIDATED",true));
  service.complete(doctor,clinicId,branchId,v.id(),"patient-batch-complete",new CompletionInput(v.version(),11,"Complete for patient release",true));
  var list=patientFollowUp.completed(actor,clinicId,branchId,List.of(v.id(),UUID.randomUUID()));assertEquals(1,list.size());assertEquals(v.id(),list.getFirst().encounterId());assertEquals(11,list.getFirst().medicalCaseVersion());
  when(patientOwner.ownPatient(actor,clinicId)).thenReturn(UUID.randomUUID());assertTrue(patientFollowUp.completed(actor,clinicId,branchId,List.of(v.id())).isEmpty());
 }
 @Test void auditRelayRetriesTheSameEventThenAcknowledges()throws Exception{
  var v=visit("relay");var attempts=new java.util.concurrent.atomic.AtomicInteger();Set<String> received=new HashSet<>();
  var server=com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1",0),0);
  server.createContext("/api/internal/audit/encounter-events",x->{received.add(json.readTree(x.getRequestBody()).get("id").asText());x.sendResponseHeaders(attempts.incrementAndGet()==1?503:200,-1);x.close();});server.start();
  try{var relay=new EncounterAuditRelay(jdbc,"synthetic-encounter-relay-secret-at-least-32-bytes","http://127.0.0.1:"+server.getAddress().getPort());
   for(int i=0;i<2;i++)new TransactionTemplate(manager).execute(s->{jdbc.execute("select set_config('app.encounter_mode','relay',true)");jdbc.update("update encounter_v2.outbox_events set status='PUBLISHED' where aggregate_id<>?",v.id());jdbc.update("update encounter_v2.outbox_events set next_attempt_at=now() where aggregate_id=?",v.id());relay.deliver();return null;});
   assertEquals(2,attempts.get());assertEquals(1,received.size());assertEquals("PUBLISHED",new TransactionTemplate(manager).execute(s->{db.scope(clinicId,branchId);return jdbc.queryForObject("select status from encounter_v2.outbox_events where aggregate_id=?",String.class,v.id());}));
  }finally{server.stop(0);}
 }
 VisitView beginCare(String key){
  var v=visit(key);service.move(receptionist,clinicId,branchId,v.ticket().id(),"call",new QueueInput(0,"Synthetic call",null));
  var ready=service.read(receptionist,clinicId,branchId,v.id());return service.care(doctor,clinicId,branchId,v.id(),"start","start-"+key,new CareInput(ready.version(),"Synthetic start",null));
 }
 @Test void awaitingResultsFreesPointPreservesEncounterAndReturnsThroughQueue(){
  var serving=beginCare("care");var next=visit("next");
  var body=new CareInput(serving.version(),"Synthetic local clinical reason",null);
  var waiting=service.care(doctor,clinicId,branchId,serving.id(),"await-results","wait",body);
  assertEquals("AWAITING_RESULTS",waiting.status());assertNull(waiting.ticket());assertEquals(serving.id(),service.care(doctor,clinicId,branchId,serving.id(),"await-results","wait",body).id());
  service.move(receptionist,clinicId,branchId,next.ticket().id(),"call",new QueueInput(0,"Next patient",null));
  var resumed=service.care(doctor,clinicId,branchId,waiting.id(),"resume-queue","return",new CareInput(waiting.version(),"Return after review",point));
  assertEquals(waiting.id(),resumed.id());assertEquals("AWAITING_RESULTS",resumed.status());assertEquals(3,resumed.ticket().number());
  assertThrows(ApiProblem.class,()->service.care(doctor,clinicId,branchId,resumed.id(),"start","too-early",new CareInput(resumed.version(),"No queue bypass",null)));
  service.move(receptionist,clinicId,branchId,next.ticket().id(),"skip",new QueueInput(1,"Synthetic skipped",null));
  service.move(receptionist,clinicId,branchId,resumed.ticket().id(),"call",new QueueInput(0,"Call return",null));
  var ready=service.read(receptionist,clinicId,branchId,resumed.id());var active=service.care(doctor,clinicId,branchId,ready.id(),"start","resume-start",new CareInput(ready.version(),"Continue care",null));
  assertEquals("IN_PROGRESS",active.status());assertEquals("SERVING",active.ticket().state());assertEquals(2,count("visits"));assertEquals(2,count("check_ins"));assertEquals(3,count("queue_tickets"));
  new TransactionTemplate(manager).execute(s->{db.scope(clinicId,branchId);assertEquals("DONE",jdbc.queryForObject("select state from encounter_v2.queue_tickets where id=?",String.class,serving.ticket().id()));var payloads=jdbc.queryForList("select payload_json from encounter_v2.outbox_events",String.class);assertTrue(payloads.stream().noneMatch(p->p.contains("clinical reason")||p.contains("Return after review")));return null;});
 }
 @Test void overnightAwaitingResultsRemainsAssignedAndGetsFreshDayTicket(){
  var serving=beginCare("overnight");var yesterday=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).minusDays(1);
  new TransactionTemplate(manager).execute(s->{db.scope(clinicId,branchId);jdbc.update("update encounter_v2.visits set created_at=now()-interval '2 days' where id=?",serving.id());jdbc.update("update encounter_v2.queue_tickets set queue_date=? where id=?",yesterday,serving.ticket().id());return null;});
  var waiting=service.care(doctor,clinicId,branchId,serving.id(),"await-results","overnight-wait",new CareInput(serving.version(),"Pending external results",null));
  assertEquals("AWAITING_RESULTS",service.worklist(doctor,clinicId,branchId).getFirst().status());assertNull(waiting.ticket());
  var result=service.care(doctor,clinicId,branchId,waiting.id(),"resume-queue","overnight-return",new CareInput(waiting.version(),"Reviewed today",point));
  assertEquals(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")),result.ticket().date());assertEquals(serving.id(),result.id());assertEquals(1,count("check_ins"));assertNull(result.appointmentId());
  var other=visit("yesterday-called");service.move(receptionist,clinicId,branchId,result.ticket().id(),"call",new QueueInput(0,"Call returned patient",null));
  new TransactionTemplate(manager).execute(s->{db.scope(clinicId,branchId);jdbc.update("update encounter_v2.queue_tickets set state='CALLED',queue_date=? where id=?",yesterday,other.ticket().id());return null;});
  assertThrows(ApiProblem.class,()->service.start(doctor,clinicId,branchId,other.id(),new QueueInput(other.version(),"Stale overnight called ticket",null)));
 }
 @Test void concurrentCareRetriesHaveOneEffectAndDifferentPayloadCannotReuseKey()throws Exception{
  var serving=beginCare("concurrent-care");var body=new CareInput(serving.version(),"Concurrent wait",null);
  var executor=Executors.newFixedThreadPool(6);try{List<Future<VisitView>> results=new ArrayList<>();for(int n=0;n<12;n++)results.add(executor.submit(()->service.care(doctor,clinicId,branchId,serving.id(),"await-results","wait-once",body)));for(var f:results)assertEquals("AWAITING_RESULTS",f.get(20,TimeUnit.SECONDS).status());}finally{executor.shutdownNow();}
  var waiting=service.read(receptionist,clinicId,branchId,serving.id());var resume=new CareInput(waiting.version(),"Return once",point);
  var first=service.care(doctor,clinicId,branchId,waiting.id(),"resume-queue","return-once",resume);assertEquals(first.ticket().id(),service.care(doctor,clinicId,branchId,waiting.id(),"resume-queue","return-once",resume).ticket().id());
  assertEquals(3,count("care_commands"));assertEquals(2,count("queue_tickets"));assertEquals(5,count("outbox_events"));
  assertThrows(ApiProblem.class,()->service.care(doctor,clinicId,branchId,serving.id(),"await-results","wait-once",new CareInput(serving.version(),"Changed reason",null)));
 }
 @Test void careChecksAssignmentRevokeScopeVersionAndRollsBackInvalidReturnPoint(){
  var serving=beginCare("denied-care");var input=new CareInput(serving.version(),"Wait",null);var other=new Actor(UUID.randomUUID(),Set.of("ROLE_DOCTOR"));
  assertThrows(ApiProblem.class,()->service.care(other,clinicId,branchId,serving.id(),"await-results","other",input));
  assertThrows(ApiProblem.class,()->service.care(doctor,clinicId,UUID.randomUUID(),serving.id(),"await-results","branch",input));
  assertThrows(ApiProblem.class,()->service.care(doctor,clinicId,branchId,serving.id(),"await-results","stale",new CareInput(0,"Stale",null)));
  when(iam.decide(eq(receptionist.id()),eq("DOCTOR_WORK"),eq(clinicId),eq(branchId))).thenReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"ADMIN",1,"Not doctor"));assertThrows(ApiProblem.class,()->service.carePoints(receptionist,clinicId,branchId));
  var waiting=service.care(doctor,clinicId,branchId,serving.id(),"await-results","good",input);
  assertThrows(ApiProblem.class,()->service.care(doctor,clinicId,branchId,waiting.id(),"resume-queue","wrong-point",new CareInput(waiting.version(),"Invalid point",UUID.randomUUID())));
  assertEquals(1,count("queue_tickets"));assertEquals(waiting.version(),service.read(receptionist,clinicId,branchId,waiting.id()).version());
  when(iam.decide(eq(doctor.id()),eq("DOCTOR_WORK"),eq(clinicId),eq(branchId))).thenReturn(new IamAuthorizationClient.Decision(false,null,null,2,"Revoked"));assertThrows(ApiProblem.class,()->service.care(doctor,clinicId,branchId,serving.id(),"await-results","good",input));assertThrows(ApiProblem.class,()->service.worklist(doctor,clinicId,branchId));
  assertEquals(0,jdbc.queryForObject("select count(*) from encounter_v2.care_commands",Integer.class));
  assertThrows(org.springframework.dao.DataAccessException.class,()->new TransactionTemplate(manager).execute(s->{db.scope(clinicId,branchId);jdbc.update("delete from encounter_v2.care_commands");return null;}));
 }
 @Test void branchTenantAndRevokeFailClosedAndOutboxHasNoLocalReason()throws Exception{
  var v=visit("scope");assertEquals(0,jdbc.queryForObject("select count(*) from encounter_v2.visits",Integer.class));
  assertThrows(ApiProblem.class,()->service.read(receptionist,UUID.randomUUID(),branchId,v.id()));assertThrows(ApiProblem.class,()->service.read(receptionist,clinicId,UUID.randomUUID(),v.id()));
  when(iam.decide(eq(receptionist.id()),eq("RECEPTION"),eq(clinicId),eq(branchId))).thenReturn(new IamAuthorizationClient.Decision(false,null,null,2,"REVOKED"));assertThrows(ApiProblem.class,()->visit("revoked"));assertEquals(1,count("visits"));
  var payload=new TransactionTemplate(manager).execute(s->{db.scope(clinicId,branchId);return jdbc.queryForObject("select payload_json from encounter_v2.outbox_events",String.class);});assertFalse(payload.contains("PHI reason"));assertEquals("/services/encounter",json.readTree(payload).get("source").asText());
  assertTrue(v.version()>=1);assertEquals(v.version(),json.readTree(payload).get("aggregateversion").asLong());
  var role=jdbc.queryForMap("select rolsuper,rolbypassrls from pg_roles where rolname=current_user");assertEquals(false,role.get("rolsuper"));assertEquals(false,role.get("rolbypassrls"));
 }
 @Test void serverRecoveryFindsOwnPendingArrivalAndResumesWithoutOriginalBrowserPayload(){
  doThrow(ApiProblem.dependency("Synthetic lost acknowledgement")).doAnswer(i->new EncounterSources.Booking(appointmentId,clinicId,branchId,patientId,linkId,doctorId,"CHECKED_IN",Instant.now(),1,i.getArgument(4))).when(sources).claim(eq(clinicId),eq(branchId),eq(appointmentId),eq(patientId),any(),any(),anyLong());
  assertThrows(ApiProblem.class,()->service.checkIn(receptionist,clinicId,branchId,appointmentId,"lost-browser",new CheckInInput(patientId,point,"Original synthetic intake")));
  var day=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));var pending=service.arrivals(receptionist,clinicId,branchId,day).getFirst().visit();assertEquals("ARRIVAL_PENDING",pending.status());
  var other=new Actor(UUID.randomUUID(),Set.of("ROLE_RECEPTIONIST"));assertTrue(service.arrivals(other,clinicId,branchId,day).isEmpty());assertThrows(ApiProblem.class,()->service.recoverArrival(other,clinicId,branchId,pending.id(),new QueueInput(0,"Recovery",null)));
  var recovered=service.recoverArrival(receptionist,clinicId,branchId,pending.id(),new QueueInput(pending.version(),"Synthetic after reload",null));assertEquals(pending.id(),recovered.id());assertEquals("WAITING",recovered.status());assertEquals(1,count("queue_tickets"));assertEquals(1,count("check_ins"));assertEquals(1,count("outbox_events"));
  doThrow(ApiProblem.dependency("Source unavailable after success")).when(sources).booking(clinicId,branchId,appointmentId);
  assertEquals(recovered.id(),service.recoverArrival(receptionist,clinicId,branchId,pending.id(),new QueueInput(0,"Read successful outcome",null)).id());
  assertEquals("Original synthetic intake",new TransactionTemplate(manager).execute(s->{db.scope(clinicId,branchId);return jdbc.queryForObject("select reason from encounter_v2.visit_history where action='CHECKED_IN'",String.class);}));
 }
 @Test void completionNeedsImmutableMedicalProofAndReplaysWhenThatSourceLaterFails(){
  var v=beginCare("complete");var in=new CompletionInput(v.version(),8,"Synthetic complete",true);
  when(medical.read(doctor,clinicId,branchId,v.id())).thenReturn(new MedicalReadinessClient.Proof(v.id(),clinicId,branchId,7,"VALIDATED",true));
  assertThrows(ApiProblem.class,()->service.complete(doctor,clinicId,branchId,v.id(),"complete",in));assertEquals("IN_PROGRESS",service.doctorRead(doctor,clinicId,branchId,v.id()).status());
  when(medical.read(doctor,clinicId,branchId,v.id())).thenReturn(new MedicalReadinessClient.Proof(v.id(),clinicId,branchId,8,"OPEN",false));
  assertThrows(ApiProblem.class,()->service.complete(doctor,clinicId,branchId,v.id(),"complete",in));
  when(medical.read(doctor,clinicId,branchId,v.id())).thenAnswer(i->{assertFalse(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive());return new MedicalReadinessClient.Proof(v.id(),clinicId,branchId,8,"VALIDATED",true);});
  var completed=service.complete(doctor,clinicId,branchId,v.id(),"complete",in);assertEquals("CLINICALLY_COMPLETED",completed.status());assertNull(completed.ticket());assertEquals(0,count("appointment_deliveries"));
  when(medical.read(doctor,clinicId,branchId,v.id())).thenThrow(ApiProblem.dependency("Synthetic unavailable"));assertEquals(completed.version(),service.complete(doctor,clinicId,branchId,v.id(),"complete",in).version());
  assertThrows(ApiProblem.class,()->service.complete(doctor,clinicId,branchId,v.id(),"complete",new CompletionInput(v.version(),8,"Changed",true)));
  var closed=service.close(doctor,clinicId,branchId,v.id(),"close",new ClosureInput(completed.version(),"Close unsigned encounter"));assertEquals("CLOSED",closed.status());assertEquals(closed.version(),service.close(doctor,clinicId,branchId,v.id(),"close",new ClosureInput(completed.version(),"Close unsigned encounter")).version());assertTrue(service.worklist(doctor,clinicId,branchId).isEmpty());
  new TransactionTemplate(manager).execute(s->{db.scope(clinicId,branchId);assertNotNull(jdbc.queryForObject("select clinically_completed_at from encounter_v2.visits where id=?",java.sql.Timestamp.class,v.id()));assertEquals("DONE",jdbc.queryForObject("select state from encounter_v2.queue_tickets where id=?",String.class,v.ticket().id()));return null;});
 }
 @Test void concurrentCompletionProducesOneReceiptAndOneBookedFulfillmentDelivery()throws Exception{
  var v=service.checkIn(receptionist,clinicId,branchId,appointmentId,"booked",new CheckInInput(patientId,point,"Synthetic arrival"));service.move(receptionist,clinicId,branchId,v.ticket().id(),"call",new QueueInput(0,"Call",null));var ready=service.doctorRead(doctor,clinicId,branchId,v.id());var active=service.care(doctor,clinicId,branchId,v.id(),"start","start",new CareInput(ready.version(),"Start",null));
  when(medical.read(doctor,clinicId,branchId,v.id())).thenReturn(new MedicalReadinessClient.Proof(v.id(),clinicId,branchId,2,"VALIDATED",true));var input=new CompletionInput(active.version(),2,"Complete once",true);var pool=Executors.newFixedThreadPool(6);
  try{List<Future<VisitView>> results=new ArrayList<>();for(int n=0;n<12;n++)results.add(pool.submit(()->service.complete(doctor,clinicId,branchId,v.id(),"same",input)));for(var f:results)assertEquals("CLINICALLY_COMPLETED",f.get(20,TimeUnit.SECONDS).status());}finally{pool.shutdownNow();}
  assertEquals(1,count("appointment_deliveries"));assertEquals(2,count("care_commands"));
  var relay=new AppointmentFulfillmentRelay(jdbc,sources);when(sources.fulfill(eq(clinicId),eq(branchId),eq(appointmentId),any(),eq(v.id()),eq(doctor.id()))).thenThrow(ApiProblem.dependency("Response lost")).thenReturn(new EncounterSources.Booking(appointmentId,clinicId,branchId,patientId,linkId,doctorId,"FULFILLED",Instant.now(),2,v.id()));
  for(int n=0;n<2;n++)new TransactionTemplate(manager).execute(s->{jdbc.execute("select set_config('app.encounter_mode','relay',true)");jdbc.update("update encounter_v2.appointment_deliveries set next_attempt_at=now() where encounter_id=?",v.id());relay.deliver();return null;});
  new TransactionTemplate(manager).execute(s->{db.scope(clinicId,branchId);assertEquals("PUBLISHED",jdbc.queryForObject("select status from encounter_v2.appointment_deliveries where encounter_id=?",String.class,v.id()));return null;});
  var event=org.mockito.ArgumentCaptor.forClass(UUID.class);verify(sources,times(2)).fulfill(eq(clinicId),eq(branchId),eq(appointmentId),event.capture(),eq(v.id()),eq(doctor.id()));assertEquals(event.getAllValues().get(0),event.getAllValues().get(1));
 }
 @Test void completionAndClosureRejectWrongActorBranchRevokeAndState(){
  var v=beginCare("complete-denied");var input=new CompletionInput(v.version(),2,"Complete",true);
  assertThrows(ApiProblem.class,()->service.close(doctor,clinicId,branchId,v.id(),"premature",new ClosureInput(v.version(),"Premature close")));
  assertThrows(ApiProblem.class,()->service.complete(new Actor(UUID.randomUUID(),Set.of()),clinicId,branchId,v.id(),"wrong",input));
  assertThrows(ApiProblem.class,()->service.complete(doctor,clinicId,UUID.randomUUID(),v.id(),"wrong",input));
  verifyNoInteractions(medical);
  when(iam.decide(eq(doctor.id()),eq("DOCTOR_WORK"),eq(clinicId),eq(branchId))).thenReturn(new IamAuthorizationClient.Decision(false,null,null,2,"Revoked"));assertThrows(ApiProblem.class,()->service.complete(doctor,clinicId,branchId,v.id(),"revoked",input));
  assertEquals(0,count("appointment_deliveries"));assertEquals("IN_PROGRESS",service.read(receptionist,clinicId,branchId,v.id()).status());
 }
 @Test void bulkAbsenceExposesPartialFailureAndBoundedNextBatch(){
  UUID absence=UUID.randomUUID();var window=new EncounterSources.Absence(absence,clinicId,branchId,doctorId,Instant.now(),Instant.now().plusSeconds(3600));when(sources.absence(clinicId,branchId,absence)).thenReturn(window);
  List<EncounterSources.ArrivalItem> rows=new ArrayList<>();for(int n=0;n<11;n++){UUID id=UUID.randomUUID();rows.add(new EncounterSources.ArrivalItem(id,"SYN-"+n,patientId,"CONFIRMED",Instant.now()));when(sources.booking(clinicId,branchId,id)).thenReturn(new EncounterSources.Booking(id,clinicId,branchId,patientId,linkId,doctorId,"CONFIRMED",Instant.now(),0,null));when(sources.exception(eq(clinicId),eq(branchId),eq(id),anyString(),any())).thenReturn(new EncounterSources.ExceptionView(UUID.randomUUID(),id,"DOCTOR_ABSENT","OPEN","MANUAL_CONTACT_REQUIRED"));}
  when(sources.affected(clinicId,branchId,window)).thenReturn(rows);when(sources.exception(eq(clinicId),eq(branchId),eq(rows.get(2).id()),anyString(),any())).thenThrow(ApiProblem.dependency("Synthetic unavailable"));
  var result=service.applyAbsence(receptionist,clinicId,branchId,absence);assertEquals(9,result.recorded());assertEquals(List.of(rows.get(2).id()),result.retryRequired());assertTrue(result.hasMore());verify(sources,never()).booking(clinicId,branchId,rows.get(10).id());
  when(iam.decide(eq(receptionist.id()),eq("CLINIC_CONFIG"),eq(clinicId),eq(branchId))).thenReturn(new IamAuthorizationClient.Decision(false,null,null,2,"DENIED"));assertThrows(ApiProblem.class,()->service.applyAbsence(receptionist,clinicId,branchId,absence));
 }
 @Test void walkInNeedsCatalogServiceAndDoctorReviewOfTheFrozenPrice(){
  assertThrows(ApiProblem.class,()->service.walkIn(receptionist,clinicId,branchId,"missing-fee",new WalkInInput(patientId,doctorId,point,"QA",null)));assertEquals(0,count("visits"));
  var v=beginCare("frozen-consultation");assertEquals(180000,v.consultation().price().amountVnd());assertEquals("Synthetic Patient",v.patient().fullName());
  when(sources.consultation(eq(receptionist),eq(clinicId),eq(branchId),eq(offeringId))).thenReturn(new Consultation(offeringId,"Changed catalog",new PriceSnapshot(UUID.randomUUID(),500000,"VND",Instant.now().minusSeconds(60),null,null)));
  assertEquals(180000,service.walkIn(receptionist,clinicId,branchId,"frozen-consultation",walk()).consultation().price().amountVnd());
  when(medical.read(doctor,clinicId,branchId,v.id())).thenReturn(new MedicalReadinessClient.Proof(v.id(),clinicId,branchId,8,"VALIDATED",true));
  assertThrows(ApiProblem.class,()->service.complete(doctor,clinicId,branchId,v.id(),"unreviewed",new CompletionInput(v.version(),8,"QA",false)));
  assertEquals("IN_PROGRESS",service.doctorRead(doctor,clinicId,branchId,v.id()).status());
  var completed=service.complete(doctor,clinicId,branchId,v.id(),"reviewed",new CompletionInput(v.version(),8,"QA",true));assertNotNull(completed.consultationPerformedAt());
  assertEquals(180000,billingProof.systemProof(billingToken("billing.source.sync"),clinicId,branchId,v.id()).consultation().price().amountVnd());
 }
}

