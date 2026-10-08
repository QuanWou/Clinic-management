package com.clinic.medical;
import com.clinic.medical.api.*;
import com.clinic.medical.api.MedicalDto.*;
import com.clinic.medical.security.*;
import com.clinic.medical.service.*;
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
@SpringBootTest(properties={"medical.security.iam-service-secret=synthetic-medical-iam-secret-more-than-32-bytes","medical.security.clinic-service-secret=synthetic-medical-clinic-secret-more-than-32-bytes","medical.security.service-secret=synthetic-medical-audit-secret-more-than-32-bytes","medical.security.billing-secret=synthetic-source-proof-secret-at-least-32-bytes"})
@EnabledIfSystemProperty(named="medical.it.enabled",matches="true")
class MedicalPostgresTest{
 @Autowired com.clinic.medical.api.ClinicalAccessAuditAdvice accessAudit;
 @Test void deniedClinicalAuditSurvivesOuterRollbackOmitsBodyAndRequiresAuthenticatedActor(){
  var request=new org.springframework.mock.web.MockHttpServletRequest("GET","/api/clinics/"+c+"/branches/"+b+"/visits/"+e+"/draft");
  var response=new org.springframework.mock.web.MockHttpServletResponse();response.setStatus(403);var body=Map.of("diagnosis","Synthetic confidential clinical text");
  var context=org.springframework.security.core.context.SecurityContextHolder.getContext();context.setAuthentication(org.springframework.security.authentication.UsernamePasswordAuthenticationToken.authenticated(doctor,null,List.of()));
  try{
   new TransactionTemplate(manager).executeWithoutResult(t->{accessAudit.beforeBodyWrite(body,null,org.springframework.http.MediaType.APPLICATION_JSON,null,new org.springframework.http.server.ServletServerHttpRequest(request),new org.springframework.http.server.ServletServerHttpResponse(response));t.setRollbackOnly();});
   new TransactionTemplate(manager).executeWithoutResult(t->{db.scope(c,b);String payload=jdbc.queryForObject("select payload_json from medical_v2.outbox_events where event_type='clinic.medical.access_recorded.v1'",String.class);assertTrue(payload.contains("DENIED"));assertTrue(payload.contains(doctor.id().toString()));assertTrue(payload.contains(e.toString()));assertFalse(payload.contains("diagnosis"));assertFalse(payload.contains("confidential"));});
   assertEquals(0,jdbc.queryForObject("select count(*) from medical_v2.outbox_events",Integer.class));
   org.springframework.security.core.context.SecurityContextHolder.clearContext();
   assertSame(body,accessAudit.beforeBodyWrite(body,null,org.springframework.http.MediaType.APPLICATION_JSON,null,new org.springframework.http.server.ServletServerHttpRequest(request),new org.springframework.http.server.ServletServerHttpResponse(response)));
   assertEquals(1,count("outbox_events"));
  }finally{org.springframework.security.core.context.SecurityContextHolder.clearContext();}
 }

 @Autowired ChargeDeliveryOperations chargeOperations;
 @Test void failedBillingDeliveryRetryDoesNotChangeReviewedOrderResultOrFrozenPrice()throws Exception{
  var o=order();o=s.transition(lab,c,b,o.id(),"accept","accept",new Transition(o.version(),"Accept"));o=s.transition(lab,c,b,o.id(),"process","process",new Transition(o.version(),"Process"));o=s.result(lab,c,b,o.id(),"result",new ResultInput(o.version(),"SYN-PRIVATE-REF","Synthetic confidential","Author"));o=s.review(doctor,c,b,o.id(),"review",new ReviewInput(o.version(),o.resultVersion(),"Review"));final var original=o;
  UUID event=new TransactionTemplate(manager).execute(t->{db.scope(c,b);jdbc.update("update medical_v2.billing_deliveries set status='DLQ',attempts=8,last_error='BILLING_INBOX_DELIVERY_FAILURE'");return jdbc.queryForObject("select event_id from medical_v2.billing_deliveries",UUID.class);});
  assertThrows(ApiProblem.class,()->chargeOperations.retry(doctor,c,b,e,event,"retry","Investigated delivery"));
  var owner=new Actor(UUID.randomUUID(),Set.of(),"Bearer synthetic");doReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"ADMIN",1,"Granted")).when(iam).decide(owner.id(),"BILLING",c,b);
  assertEquals("PENDING",chargeOperations.retry(owner,c,b,e,event,"retry","Investigated delivery").events().getFirst().status());assertEquals("PENDING",chargeOperations.retry(owner,c,b,e,event,"retry","Investigated delivery").events().getFirst().status());assertEquals(1,count("charge_recovery_commands"));
  assertThrows(ApiProblem.class,()->chargeOperations.retry(owner,c,b,e,event,"retry","Changed"));assertThrows(ApiProblem.class,()->chargeOperations.retry(owner,c,b,e,event,"new-key","Already pending"));var source=s.orders(doctor,c,b,e).getFirst();assertEquals(original.version(),source.version());assertEquals(original.result().id(),source.result().id());assertEquals(100000,billingProof.reviewedOrder(billingToken("billing.source.sync"),c,b,source.id()).price().amountVnd());
  new TransactionTemplate(manager).execute(t->{db.scope(c,b);assertEquals(1,jdbc.queryForObject("select count(*) from medical_v2.outbox_events where event_type='clinic.medical.billing_retry_requested.v1'",Integer.class));String audit=jdbc.queryForObject("select payload_json from medical_v2.outbox_events where event_type='clinic.medical.billing_retry_requested.v1'",String.class);assertFalse(audit.contains("confidential"));jdbc.update("update medical_v2.billing_deliveries set status='PUBLISHED'");return null;});assertEquals("PUBLISHED",chargeOperations.retry(owner,c,b,e,event,"retry","Investigated delivery").events().getFirst().status());
  UUID other=UUID.randomUUID();doReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"ADMIN",1,"Other branch")).when(iam).decide(owner.id(),"BILLING",c,other);assertTrue(chargeOperations.read(owner,c,other,e).events().isEmpty());assertThrows(ApiProblem.class,()->chargeOperations.retry(owner,c,other,e,event,"wrong","Wrong branch"));doReturn(new IamAuthorizationClient.Decision(false,null,null,2,"Revoked")).when(iam).decide(owner.id(),"BILLING",c,b);assertThrows(ApiProblem.class,()->chargeOperations.read(owner,c,b,e));
 }
 @Autowired com.clinic.medical.api.BillingProofController billingProof;
 String billingToken(String scope){var now=Instant.now();return "Bearer "+io.jsonwebtoken.Jwts.builder().issuer("billing-service").subject("billing-service").audience().add("medical-service").and().id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",List.of(scope)).issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(30))).signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor("synthetic-source-proof-secret-at-least-32-bytes".getBytes(java.nio.charset.StandardCharsets.UTF_8))).compact();}
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired MedicalService s;@Autowired JdbcTemplate jdbc;@Autowired MedicalDb db;@Autowired PlatformTransactionManager manager;
 @MockBean IamAuthorizationClient iam;@MockBean MedicalSources source;
 @MockBean PatientOwnershipClient patientOwner;@MockBean PatientEncounterSource patientEncounter;@Autowired PatientFollowUpService patientFollowUp;@Autowired PatientRecordService patientRecords;
 UUID c,b,e,patient,practitioner,offering;Actor doctor,lab;Note note;
 @BeforeEach void fixture(){c=UUID.randomUUID();b=UUID.randomUUID();e=UUID.randomUUID();patient=UUID.randomUUID();practitioner=UUID.randomUUID();offering=UUID.randomUUID();doctor=new Actor(UUID.randomUUID(),Set.of("ROLE_DOCTOR"),"Bearer synthetic");lab=doctor;
  when(iam.decide(any(),anyString(),any(),any())).thenAnswer(i->{boolean allowed=c.equals(i.getArgument(2))&&b.equals(i.getArgument(3));String role="DOCTOR";return new IamAuthorizationClient.Decision(allowed,UUID.randomUUID(),role,1,"Synthetic");});
  when(source.visit(eq(doctor),eq(c),eq(b),eq(e))).thenReturn(new MedicalSources.Visit(e,c,b,patient,practitioner,"IN_PROGRESS",1));
  when(source.identities(eq(doctor),eq(c),eq(b),anyList())).thenReturn(List.of(new MedicalSources.Visit(e,c,b,patient,practitioner,"IN_PROGRESS",1)));
  when(source.price(doctor,c,b,offering)).thenReturn(new MedicalSources.Snapshot(UUID.randomUUID(),c,b,offering,100000,"VND",null,null,Instant.now().minusSeconds(10),Instant.now()));
  when(source.offeringName(doctor,c,b,offering)).thenReturn("Synthetic Catalog Service");
  note=new Note("Synthetic reason","Synthetic history","Synthetic allergy","Synthetic vitals","Synthetic exam","Synthetic diagnosis","Synthetic conclusion","Synthetic instructions",null);
 }
 int count(String table){return new TransactionTemplate(manager).execute(t->{db.scope(c,b);return jdbc.queryForObject("select count(*) from medical_v2."+table,Integer.class);});}
 DraftView save(){return s.save(doctor,c,b,e,"draft",new DraftInput(0,note,"Synthetic draft reason"));}
 OrderView order(){var d=save();return s.order(doctor,c,b,e,"order",new OrderInput(d.caseVersion(),offering,"Synthetic order reason"));}
 @Test void resultHistoryRetainsReviewedAndRejectedOrdersWithoutOpeningOtherDoctorOrClinicAccess(){
  var o=order();o=s.transition(doctor,c,b,o.id(),"accept","accept",new Transition(o.version(),"Accept"));o=s.transition(doctor,c,b,o.id(),"process","process",new Transition(o.version(),"Process"));
  o=s.result(doctor,c,b,o.id(),"result-1",new ResultInput(o.version(),"QA-1","Version one","Author"));o=s.result(doctor,c,b,o.id(),"result-2",new ResultInput(o.version(),"QA-2","Version two","Correct"));
  o=s.review(doctor,c,b,o.id(),"review",new ReviewInput(o.version(),o.resultVersion(),"Review current version"));
  var second=s.order(doctor,c,b,e,"second",new OrderInput(s.draft(doctor,c,b,e).caseVersion(),offering,"Second order"));second=s.transition(doctor,c,b,second.id(),"reject","reject",new Transition(second.version(),"Not performed"));
  var day=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));var first=s.labHistory(doctor,c,b,day,day,null,1);assertEquals(1,first.items().size());assertNotNull(first.nextAfter());var next=s.labHistory(doctor,c,b,day,day,first.nextAfter(),1);assertEquals(1,next.items().size());assertNull(next.nextAfter());assertNotEquals(first.items().getFirst().id(),next.items().getFirst().id());assertEquals(Set.of("REVIEWED","REJECTED"),Set.of(first.items().getFirst().state(),next.items().getFirst().state()));assertTrue(s.lab(doctor,c,b).isEmpty());
  var versions=s.resultHistory(doctor,c,b,o.id());assertEquals(List.of(2L,1L),versions.stream().map(ResultView::version).toList());assertEquals("Version one",versions.getLast().content());
  assertTrue(s.labHistory(doctor,c,b,day.minusDays(2),day.minusDays(1),null,50).items().isEmpty());assertThrows(ApiProblem.class,()->s.labHistory(doctor,c,b,day,day.minusDays(1),null,50));assertThrows(ApiProblem.class,()->s.labHistory(doctor,c,b,day,day,null,101));
  var other=new Actor(UUID.randomUUID(),Set.of(),"Bearer other-doctor");assertTrue(s.labHistory(other,c,b,day,day,null,50).items().isEmpty());final UUID id=o.id();assertThrows(ApiProblem.class,()->s.resultHistory(other,c,b,id));assertThrows(ApiProblem.class,()->s.labHistory(doctor,c,UUID.randomUUID(),day,day,null,50));
 }
 @Test void ownFollowUpDateRequiresValidatedOwnedCaseAndNeverReleasesNoteContent()throws Exception{
  var date=LocalDate.now().plusDays(7);note=new Note(note.reasonForVisit(),note.medicalHistory(),note.allergies(),note.vitals(),note.examination(),note.preliminaryDiagnosis(),note.conclusion(),note.instructions(),date);
  var actor=new Actor(UUID.randomUUID(),Set.of("ROLE_USER"),"Bearer synthetic-patient");when(patientOwner.ownPatient(actor,c)).thenAnswer(i->{assertFalse(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive());return patient;});
  var draft=save();assertTrue(patientFollowUp.list(actor,c,b).isEmpty());assertThrows(ApiProblem.class,()->patientFollowUp.proof(actor,c,b,e));
  var valid=s.validate(doctor,c,b,e,"validate",new Transition(draft.caseVersion(),"Synthetic immutable plan"));var list=patientFollowUp.list(actor,c,b);assertEquals(1,list.size());assertEquals(date,list.getFirst().proposedDate());assertEquals(valid.caseVersion(),patientFollowUp.proof(actor,c,b,e).caseVersion());
  var encoded=new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().writeValueAsString(list);for(String secret:List.of("Synthetic reason","Synthetic diagnosis","Synthetic history","Synthetic instructions","patientId","content"))assertFalse(encoded.contains(secret));
  assertTrue(patientFollowUp.list(actor,c,UUID.randomUUID()).isEmpty());when(patientOwner.ownPatient(actor,c)).thenReturn(UUID.randomUUID());assertTrue(patientFollowUp.list(actor,c,b).isEmpty());assertThrows(ApiProblem.class,()->patientFollowUp.proof(actor,c,b,e));when(patientOwner.ownPatient(actor,c)).thenThrow(ApiProblem.forbidden());assertThrows(ApiProblem.class,()->patientFollowUp.list(actor,c,b));assertEquals(0,jdbc.queryForObject("select count(*) from medical_v2.cases",Integer.class));
 }
 @Test void patientPortalOnlyReleasesValidatedCompletedRecordAndReviewedResults(){
  var actor=new Actor(UUID.randomUUID(),Set.of("ROLE_USER"),"Bearer synthetic-patient");when(patientOwner.ownPatient(actor,c)).thenReturn(patient);
  var o=order();o=s.transition(lab,c,b,o.id(),"accept","portal-accept",new Transition(o.version(),"Accept"));o=s.transition(lab,c,b,o.id(),"process","portal-process",new Transition(o.version(),"Process"));o=s.result(lab,c,b,o.id(),"portal-result",new ResultInput(o.version(),"PORTAL-LAB","Synthetic reviewed result for patient","Result authored"));o=s.review(doctor,c,b,o.id(),"portal-review",new ReviewInput(o.version(),o.resultVersion(),"Doctor reviewed patient result"));
  var current=s.draft(doctor,c,b,e);var valid=s.validate(doctor,c,b,e,"portal-validate",new Transition(current.caseVersion(),"Validate patient record"));
  when(patientEncounter.completed(eq(actor),eq(c),eq(b),anyList())).thenReturn(List.of());assertTrue(patientRecords.list(actor,c,b).isEmpty());
  when(patientEncounter.completed(eq(actor),eq(c),eq(b),anyList())).thenReturn(List.of(new PatientEncounterSource.Proof(e,c,b,patient,"CLINICALLY_COMPLETED",valid.caseVersion())));
  var records=patientRecords.list(actor,c,b);assertEquals(1,records.size());var record=records.getFirst();assertEquals(e,record.encounterId());assertEquals("Synthetic conclusion",record.content().conclusion());assertEquals(1,record.results().size());assertEquals("Synthetic reviewed result for patient",record.results().getFirst().content());assertNotNull(record.results().getFirst().reviewedAt());
  when(patientEncounter.completed(eq(actor),eq(c),eq(b),anyList())).thenReturn(List.of(new PatientEncounterSource.Proof(e,c,b,patient,"CLINICALLY_COMPLETED",valid.caseVersion()+1)));assertTrue(patientRecords.list(actor,c,b).isEmpty());
  when(patientOwner.ownPatient(actor,c)).thenReturn(UUID.randomUUID());assertTrue(patientRecords.list(actor,c,b).isEmpty());
 }
 @Test void concurrentDraftReplayHasOneAppendOnlyVersionAndChangedPayloadConflicts()throws Exception{
  var executor=Executors.newFixedThreadPool(6);try{var pending=new ArrayList<Future<DraftView>>();for(int n=0;n<18;n++)pending.add(executor.submit(this::save));for(var f:pending)assertEquals(1,f.get(20,TimeUnit.SECONDS).documentVersion());}finally{executor.shutdownNow();}
  assertEquals(1,count("document_versions"));assertEquals(1,count("outbox_events"));assertEquals(1,count("history"));
  assertThrows(ApiProblem.class,()->s.save(doctor,c,b,e,"draft",new DraftInput(1,note,"Different reason")));
  assertThrows(org.springframework.dao.DataAccessException.class,()->new TransactionTemplate(manager).execute(t->{db.scope(c,b);jdbc.update("update medical_v2.document_versions set content_json='{}'");return null;}));
  assertEquals("Synthetic conclusion",s.draft(doctor,c,b,e).content().conclusion());
 }
 @Test void competingAutosavesFromSameBaseVersionCannotOverwriteSilently()throws Exception{
  var pool=Executors.newFixedThreadPool(2);var barrier=new CyclicBarrier(2);try{var futures=new ArrayList<Future<Boolean>>();for(int n=0;n<2;n++){final int index=n;futures.add(pool.submit(()->{barrier.await();try{s.save(doctor,c,b,e,"tab-"+index,new DraftInput(0,note,"Tab "+index));return true;}catch(ApiProblem p){assertEquals("STATE_CONFLICT",p.code);return false;}}));}int successes=0;for(var f:futures)if(f.get(20,TimeUnit.SECONDS))successes++;assertEquals(1,successes);assertEquals(1,count("document_versions"));}finally{pool.shutdownNow();}
 }
 @Test void authenticatedResultMustBeReviewedBeforeValidationAndPriceRemainsFrozen(){
  var o=order();var d=s.draft(doctor,c,b,e);assertThrows(ApiProblem.class,()->s.validate(doctor,c,b,e,"premature",new Transition(d.caseVersion(),"Do not auto-complete")));
  o=s.transition(lab,c,b,o.id(),"accept","accept",new Transition(o.version(),"Synthetic acceptance"));o=s.transition(lab,c,b,o.id(),"process","process",new Transition(o.version(),"Synthetic processing"));
  var input=new ResultInput(o.version(),"SYN-LAB-001","Synthetic confidential result","Synthetic authored result");o=s.result(lab,c,b,o.id(),"result",input);assertEquals(lab.id(),o.result().authorUserId());assertEquals(o.result().id(),s.result(lab,c,b,o.id(),"result",input).result().id());
  final var resulted=o;assertThrows(ApiProblem.class,()->s.validate(doctor,c,b,e,"before-review",new Transition(s.draft(doctor,c,b,e).caseVersion(),"Review is required")));
  assertThrows(ApiProblem.class,()->s.review(doctor,c,b,resulted.id(),"wrong-result",new ReviewInput(resulted.version(),2,"Wrong result version")));
  o=s.review(doctor,c,b,o.id(),"review",new ReviewInput(o.version(),o.resultVersion(),"Synthetic doctor review"));assertEquals("REVIEWED",o.state());assertEquals(doctor.id(),o.reviewedBy());
  var current=s.draft(doctor,c,b,e);assertFalse(s.readiness(doctor,c,b,e).ready());var valid=s.validate(doctor,c,b,e,"validate",new Transition(current.caseVersion(),"Unsigned clinical validation"));assertEquals("VALIDATED",valid.status());assertTrue(s.readiness(doctor,c,b,e).ready());assertEquals(valid.caseVersion(),s.readiness(doctor,c,b,e).caseVersion());
  assertThrows(ApiProblem.class,()->s.save(doctor,c,b,e,"overwrite",new DraftInput(valid.documentVersion(),note,"Cannot overwrite validated version")));
  new TransactionTemplate(manager).execute(t->{db.scope(c,b);String snapshot=jdbc.queryForObject("select price_snapshot_json from medical_v2.orders",String.class);assertTrue(snapshot.contains("100000"));assertTrue(jdbc.queryForList("select payload_json from medical_v2.outbox_events",String.class).stream().noneMatch(x->x.contains("confidential")||x.contains("Synthetic diagnosis")||x.contains("Synthetic history")));return null;});
 }
 @Test void reviewedBillingSystemProofHasDedicatedScopeFrozenPriceAndNoClinicalContent()throws Exception{
  var o=order();final var pending=o;assertThrows(ApiProblem.class,()->billingProof.reviewedOrder(billingToken("billing.source.sync"),c,b,pending.id()));
  o=s.transition(lab,c,b,o.id(),"accept","accept",new Transition(o.version(),"Accept"));o=s.transition(lab,c,b,o.id(),"process","process",new Transition(o.version(),"Process"));o=s.result(lab,c,b,o.id(),"result",new ResultInput(o.version(),"SYN-PRIVATE-REF","Synthetic confidential","Author"));o=s.review(doctor,c,b,o.id(),"review",new ReviewInput(o.version(),o.resultVersion(),"Review"));
  final var reviewed=o;assertThrows(ApiProblem.class,()->billingProof.reviewedOrder(billingToken("billing.source.read"),c,b,reviewed.id()));assertThrows(ApiProblem.class,()->billingProof.reviewedOrder("Bearer invalid",c,b,reviewed.id()));assertThrows(ApiProblem.class,()->billingProof.reviewedOrder(billingToken("billing.source.sync"),c,UUID.randomUUID(),reviewed.id()));
  var proof=billingProof.reviewedOrder(billingToken("billing.source.sync"),c,b,reviewed.id());assertEquals(patient,proof.patientId());assertEquals(e,proof.encounterId());assertEquals(100000,proof.price().amountVnd());String encoded=new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().writeValueAsString(proof);for(String privateField:List.of("confidential","SYN-PRIVATE-REF","Synthetic diagnosis","Synthetic instructions","content"))assertFalse(encoded.contains(privateField));assertEquals(1,count("billing_deliveries"));
 }
 @Test void labClaimIsExclusiveAndOtherLabCannotAuthorOrReadDoctorDraft()throws Exception{
  var o=order();var another=new Actor(UUID.randomUUID(),Set.of("ROLE_USER"),"Bearer synthetic");var ready=o;var pool=Executors.newFixedThreadPool(2);var gate=new CyclicBarrier(2);try{var a=pool.submit(()->{gate.await();try{return s.transition(lab,c,b,ready.id(),"accept","lab-one",new Transition(0,"Claim")).acceptedBy();}catch(ApiProblem p){return null;}});var z=pool.submit(()->{gate.await();try{return s.transition(another,c,b,ready.id(),"accept","lab-two",new Transition(0,"Claim")).acceptedBy();}catch(ApiProblem p){return null;}});var owners=Arrays.asList(a.get(20,TimeUnit.SECONDS),z.get(20,TimeUnit.SECONDS));assertEquals(1,owners.stream().filter(Objects::nonNull).count());Actor winner=owners.contains(lab.id())?lab:another,loser=winner==lab?another:lab;var processing=s.transition(winner,c,b,ready.id(),"process","process",new Transition(1,"Processing"));assertThrows(ApiProblem.class,()->s.result(loser,c,b,ready.id(),"bad",new ResultInput(processing.version(),"SOURCE","Synthetic result","Wrong claimant")));assertThrows(ApiProblem.class,()->s.draft(loser,c,b,e));}finally{pool.shutdownNow();}
 }
 @Test void missingMandatoryContentAndActiveOrdersCannotValidateAndCancelledOrdersKeepHistory(){
  var empty=new Note("","","","","","","","",null);var d=s.save(doctor,c,b,e,"empty",new DraftInput(0,empty,"Draft allowed incomplete"));long emptyVersion=d.caseVersion();assertThrows(ApiProblem.class,()->s.validate(doctor,c,b,e,"invalid",new Transition(emptyVersion,"Must remain draft")));
  d=s.save(doctor,c,b,e,"filled",new DraftInput(d.documentVersion(),note,"Explicit complete content"));var o=s.order(doctor,c,b,e,"ordered",new OrderInput(d.caseVersion(),offering,"Order"));
  o=s.transition(doctor,c,b,o.id(),"cancel","cancel",new Transition(o.version(),"Synthetic clinical cancellation"));assertEquals("CANCELLED",o.state());assertEquals(0,count("results"));var current=s.draft(doctor,c,b,e);assertEquals("VALIDATED",s.validate(doctor,c,b,e,"validated",new Transition(current.caseVersion(),"Explicit doctor validation")).status());assertEquals(2,count("document_versions"));assertEquals(1,count("orders"));
 }
 @Test void tenantRoleRevokeAndClinicalStateFailClosed(){
  var d=save();assertEquals(0,jdbc.queryForObject("select count(*) from medical_v2.document_versions",Integer.class));assertThrows(ApiProblem.class,()->s.draft(doctor,c,UUID.randomUUID(),e));assertThrows(ApiProblem.class,()->s.draft(new Actor(UUID.randomUUID(),Set.of("ROLE_DOCTOR"),"Bearer other-doctor"),c,b,e));
  when(source.visit(doctor,c,b,e)).thenReturn(new MedicalSources.Visit(e,c,b,patient,practitioner,"CLINICALLY_COMPLETED",3));assertThrows(ApiProblem.class,()->s.save(doctor,c,b,e,"late",new DraftInput(d.documentVersion(),note,"Late edit")));
  when(iam.decide(eq(doctor.id()),eq("DOCTOR_WORK"),eq(c),eq(b))).thenReturn(new IamAuthorizationClient.Decision(false,null,null,2,"Revoked"));assertThrows(ApiProblem.class,()->s.draft(doctor,c,b,e));assertEquals(1,count("document_versions"));
 }
}

