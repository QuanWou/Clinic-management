package com.clinic.v2.billing;
import com.clinic.v2.billing.api.*;
import com.clinic.v2.billing.api.BillingDto.*;
import com.clinic.v2.billing.security.*;
import com.clinic.v2.billing.service.*;
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
import java.util.function.Supplier;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={"billing.security.iam-service-secret=synthetic-billing-iam-secret-more-than-32-bytes","billing.security.clinic-service-secret=synthetic-billing-clinic-secret-more-than-32-bytes","billing.security.service-secret=synthetic-billing-audit-secret-more-than-32-bytes","billing.charges.medical-secret=synthetic-medical-charge-source-secret-more-than-32-bytes","billing.charges.encounter-secret=synthetic-encounter-charge-source-secret-more-than-32-bytes"})
@EnabledIfSystemProperty(named="billing.it.enabled",matches="true")
class BillingPostgresTest {
 @Autowired SourceChargeOperations chargeOperations;
 @Test void failedChargeRequiresManagerAndKeyedReplayPreservesSourceMoneyAndScope()throws Exception{
  isolateChargeFixtures();var event=chargeEvent();UUID id=UUID.fromString(event.path("id").asText());charges.ingest("medical-v2-service",event);
  local(()->jdbc.update("update billing_v2.charge_event_inbox set status='DLQ',attempts=8,last_error='SOURCE_PROOF_OR_RECONCILIATION_FAILURE'"));
  assertEquals("DLQ",chargeOperations.read(cashier,c,b,e).events().getFirst().status());assertThrows(ApiProblem.class,()->chargeOperations.retry(cashier,c,b,e,id,"retry","Investigated source"));
  var pool=Executors.newFixedThreadPool(4);try{var requests=new ArrayList<Future<SourceChargeOperations.State>>();for(int n=0;n<8;n++)requests.add(pool.submit(()->chargeOperations.retry(managerActor,c,b,e,id,"retry","Investigated source")));for(var request:requests)assertEquals("PENDING",request.get(20,TimeUnit.SECONDS).events().getFirst().status());}finally{pool.shutdownNow();}
  assertEquals(1,count("charge_recovery_commands"));assertEquals(1,count("outbox_events"));assertEquals(0,count("journals"));assertEquals(0,count("bills"));
  assertThrows(ApiProblem.class,()->chargeOperations.retry(managerActor,c,b,e,id,"retry","Changed reason"));assertThrows(ApiProblem.class,()->chargeOperations.retry(managerActor,c,b,e,id,"another","Cannot reset active worker"));
  doReturn(performed()).when(chargeSource).reviewed(c,b,e,order,4);charges.deliverBatch();assertEquals("APPLIED",chargeOperations.retry(managerActor,c,b,e,id,"retry","Investigated source").events().getFirst().status());assertEquals(1,count("charges"));assertEquals(0,count("journals"));assertEquals(0,count("bills"));
  String frozen=local(()->jdbc.queryForObject("select payload_json::text from billing_v2.charge_event_inbox",String.class));assertEquals(event,json.readTree(frozen));
  UUID otherBranch=UUID.randomUUID();doReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"CLINIC_OWNER",1,"Other grant")).when(iam).decide(managerActor.id(),"BILLING",c,otherBranch);assertTrue(chargeOperations.read(managerActor,c,otherBranch,e).events().isEmpty());assertThrows(ApiProblem.class,()->chargeOperations.retry(managerActor,c,otherBranch,e,id,"wrong","Wrong scope"));
  doReturn(new IamAuthorizationClient.Decision(false,null,null,2,"Revoked")).when(iam).decide(managerActor.id(),"BILLING",c,b);assertThrows(ApiProblem.class,()->chargeOperations.read(managerActor,c,b,e));assertEquals(0,jdbc.queryForObject("select count(*) from billing_v2.charge_recovery_commands",Integer.class));
 }
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired BillingService s;@Autowired JdbcTemplate jdbc;@Autowired BillingDb db;@Autowired PlatformTransactionManager manager;
 @MockBean IamAuthorizationClient iam;@MockBean BillingSources source;
 @MockBean FinancialNotificationClient notification;@Autowired BillingNotificationDelivery delivery;
 @MockBean ChargeSourceClient chargeSource;@Autowired SourceChargeService charges;@Autowired com.fasterxml.jackson.databind.ObjectMapper json;@Autowired org.springframework.boot.test.web.client.TestRestTemplate http;
 @MockBean PatientBillingIdentity patientIdentity;@Autowired PatientBillingService portal;@Autowired OperationsSummaryController operations;
 UUID c,b,e,patient,offering,order;Actor cashier,other,managerActor;BillingSources.Snapshot price;
 @BeforeEach void fixture(){http.getRestTemplate().setRequestFactory(new org.springframework.http.client.JdkClientHttpRequestFactory());c=UUID.randomUUID();b=UUID.randomUUID();e=UUID.randomUUID();patient=UUID.randomUUID();offering=UUID.randomUUID();order=UUID.randomUUID();cashier=new Actor(UUID.randomUUID(),Set.of(),"Bearer synthetic");other=new Actor(UUID.randomUUID(),Set.of(),"Bearer synthetic");managerActor=new Actor(UUID.randomUUID(),Set.of(),"Bearer synthetic");price=new BillingSources.Snapshot(UUID.randomUUID(),100000,"VND",Instant.now().minusSeconds(100),null,null);
  when(iam.decide(any(),eq("BILLING"),any(),any())).thenAnswer(i->new IamAuthorizationClient.Decision(c.equals(i.getArgument(2))&&b.equals(i.getArgument(3)),UUID.randomUUID(),managerActor.id().equals(i.getArgument(0))?"CLINIC_MANAGER":"CASHIER",1,"Synthetic"));
  when(source.proof(any(),eq(c),eq(b),eq(e))).thenAnswer(i->{assertFalse(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive());return new BillingSources.Proof(e,patient,List.of(new BillingSources.Charge("MEDICAL_ORDER",order,offering,"Synthetic Performed Lab",price)));});
 }
 <T>T local(Supplier<T> body){return new TransactionTemplate(manager).execute(t->{db.scope(c,b);return body.get();});}
 int count(String table){return local(()->jdbc.queryForObject("select count(*) from billing_v2."+table,Integer.class));}
 @Test void operationsSeparatesDailyImmutableTenderFromCurrentOutstandingAndRequiresManager()throws Exception{
  var date=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));var billed=bill();var shift=shift(cashier);s.collect(cashier,c,b,billed.id(),"report-cash",new PaymentInput(0,shift.id(),40000,"CASH",null,"Private collector reason"));
  assertThrows(ApiProblem.class,()->operations.read(cashier,c,b,date));
  var report=operations.read(managerActor,c,b,date);assertEquals(100000,report.issuedVnd());assertEquals(40000,report.collectedCashVnd());assertEquals(0,report.collectedBankVnd());assertEquals(0,report.collectedPosVnd());assertEquals(1,report.receiptCount());assertEquals(60000,report.outstandingVnd());assertEquals(1,report.openShifts());
  var future=operations.read(managerActor,c,b,date.plusDays(1));assertEquals(0,future.issuedVnd());assertEquals(0,future.collectedCashVnd());assertEquals(0,future.receiptCount());assertEquals(60000,future.outstandingVnd());
  var submitted=s.submit(cashier,c,b,shift.id(),"report-submit",new ShiftSubmit(0,40000,0,0,"Counted cash"));assertEquals(1,operations.read(managerActor,c,b,date).submittedShifts());
  s.approve(managerActor,c,b,shift.id(),"report-approve",new ApproveInput(submitted.version(),"Separate approver"));assertEquals(1,operations.read(managerActor,c,b,date).approvedShifts());assertEquals(0,operations.read(managerActor,c,b,date).submittedShifts());
  String payload=new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().writeValueAsString(report);for(String forbidden:List.of("patientId","collectorUserId","Private collector reason",patient.toString(),billed.id().toString()))assertFalse(payload.contains(forbidden));
  UUID otherBranch=UUID.randomUUID();when(iam.decide(managerActor.id(),"BILLING",c,otherBranch)).thenReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"CLINIC_OWNER",1,"Synthetic branch grant"));assertEquals(0,operations.read(managerActor,c,otherBranch,date).outstandingVnd());
  when(iam.decide(managerActor.id(),"BILLING",c,b)).thenReturn(new IamAuthorizationClient.Decision(false,null,null,2,"Revoked"));assertThrows(ApiProblem.class,()->operations.read(managerActor,c,b,date));assertEquals(0,jdbc.queryForObject("select count(*) from billing_v2.bills",Integer.class));
 }
 @Test void financialNotificationHasIndependentAckAndNoRecipientLookupInsideMoneyTransaction(){
  quarantineOlderNotificationFixtures();
  UUID user=UUID.randomUUID();when(notification.recipient(c,patient)).thenAnswer(i->{assertFalse(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive());return new FinancialNotificationClient.Recipient("OWNED",user);});
  doAnswer(i->{assertFalse(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive());var event=(com.fasterxml.jackson.databind.JsonNode)i.getArgument(0);assertEquals(user.toString(),event.path("data").path("recipientUserId").asText());assertFalse(event.path("data").has("actorUserId"));assertFalse(event.toString().contains("amount"));return null;}).when(notification).send(any());
  var billed=bill();assertEquals(1,count("notification_deliveries"));verify(notification,never()).recipient(any(),any());
  local(()->{jdbc.update("update billing_v2.outbox_events set status='PUBLISHED'");return null;});delivery.deliverBatch();delivery.deliverBatch();
  verify(notification,times(1)).send(any());assertEquals("DELIVERED",local(()->jdbc.queryForObject("select status from billing_v2.notification_deliveries",String.class)));assertEquals(user,local(()->jdbc.queryForObject("select recipient_user_id from billing_v2.notification_deliveries",UUID.class)));assertEquals(100000,s.read(cashier,c,b,billed.id()).remainingVnd());
  assertThrows(org.springframework.dao.DataAccessException.class,()->local(()->jdbc.update("update billing_v2.notification_deliveries set recipient_user_id=?",UUID.randomUUID())));
 }
 @Test void missingOrRevokedRecipientProducesExplicitManualContactAndOutageDoesNotLoseDelivery(){
  quarantineOlderNotificationFixtures();
  bill();when(notification.recipient(c,patient)).thenThrow(ApiProblem.dependency("Synthetic Patient source offline"));delivery.deliverBatch();assertEquals("PENDING",local(()->jdbc.queryForObject("select status from billing_v2.notification_deliveries",String.class)));assertEquals(1,local(()->jdbc.queryForObject("select attempts from billing_v2.notification_deliveries",Integer.class)));verify(notification,never()).send(any());
  doReturn(new FinancialNotificationClient.Recipient("NO_ACCOUNT",null)).when(notification).recipient(c,patient);local(()->jdbc.update("update billing_v2.notification_deliveries set next_attempt_at=now()"));delivery.deliverBatch();assertEquals("MANUAL_CONTACT",local(()->jdbc.queryForObject("select status from billing_v2.notification_deliveries",String.class)));assertEquals("NO_ACCOUNT",local(()->jdbc.queryForObject("select last_error from billing_v2.notification_deliveries",String.class)));
 }
 @Test void expiredNotificationLeaseCanBeReclaimedButOldWorkerCannotAcknowledgeNewClaim(){
  quarantineOlderNotificationFixtures();
  bill();var first=delivery.claim();assertNotNull(first);assertNull(delivery.claim());local(()->jdbc.update("update billing_v2.notification_deliveries set lease_until=now()-interval '1 second'"));var second=delivery.claim();assertNotEquals(first.lease(),second.lease());delivery.finish(first,"DELIVERED",null);assertEquals("CLAIMED",local(()->jdbc.queryForObject("select status from billing_v2.notification_deliveries",String.class)));
  when(notification.recipient(c,patient)).thenReturn(new FinancialNotificationClient.Recipient("LINK_UNAVAILABLE",null));delivery.deliver(second);assertEquals("MANUAL_CONTACT",local(()->jdbc.queryForObject("select status from billing_v2.notification_deliveries",String.class)));assertEquals("LINK_UNAVAILABLE",local(()->jdbc.queryForObject("select last_error from billing_v2.notification_deliveries",String.class)));verify(notification,never()).send(any());
 }
 @Test void notificationDlqRecoveryRequiresManagerAndReplaysWithoutChangingMoneyOrEnqueuingAnotherFinancialMessage(){
  quarantineOlderNotificationFixtures();var billed=bill();when(notification.recipient(c,patient)).thenReturn(new FinancialNotificationClient.Recipient("OWNED",UUID.randomUUID()));doThrow(ApiProblem.dependency("Synthetic Notification unavailable")).when(notification).send(any());
  for(int i=0;i<5;i++){local(()->jdbc.update("update billing_v2.notification_deliveries set next_attempt_at=now()"));delivery.deliverBatch();}
  assertEquals(1,s.notifications(cashier,c,b,billed.id()).failed());assertThrows(ApiProblem.class,()->s.retryNotifications(cashier,c,b,billed.id(),"retry","Cashier cannot requeue"));
  assertEquals(1,s.retryNotifications(managerActor,c,b,billed.id(),"retry","Synthetic owner-reviewed delivery recovery").pending());assertEquals(1,s.retryNotifications(managerActor,c,b,billed.id(),"retry","Synthetic owner-reviewed delivery recovery").pending());assertEquals(2,count("outbox_events"));assertEquals(1,count("notification_deliveries"));assertEquals(1,s.read(cashier,c,b,billed.id()).version());assertEquals(100000,s.read(cashier,c,b,billed.id()).remainingVnd());assertEquals(1,count("journals"));
  assertThrows(ApiProblem.class,()->s.retryNotifications(managerActor,c,b,billed.id(),"retry","Changed retry reason"));doNothing().when(notification).send(any());delivery.deliverBatch();assertEquals(1,s.notifications(cashier,c,b,billed.id()).delivered());assertEquals(0,s.notifications(cashier,c,b,billed.id()).failed());
 }
 void quarantineOlderNotificationFixtures(){new TransactionTemplate(manager).execute(t->{jdbc.execute("select set_config('app.billing_mode','notification-relay',true)");jdbc.update("update billing_v2.notification_deliveries set next_attempt_at=now()+interval '1 day' where status='PENDING'");return null;});}
 com.fasterxml.jackson.databind.node.ObjectNode chargeEvent(){var event=json.createObjectNode().put("specversion","1.0").put("id",UUID.randomUUID().toString()).put("source","/services/medical").put("type","clinic.medical.result_reviewed.v1").put("subject","encounter/"+e).put("time",Instant.now().toString()).put("datacontenttype","application/json").put("clinicid",c.toString()).put("branchid",b.toString()).put("correlationid",UUID.randomUUID().toString()).put("aggregateversion",4);event.putObject("data").put("encounterId",e.toString()).put("resourceId",order.toString()).put("actorUserId",UUID.randomUUID().toString());return event;}
 List<BillingSources.Charge> performed(){return List.of(new BillingSources.Charge("MEDICAL_ORDER",order,offering,"Synthetic Performed Lab",price));}
 void isolateChargeFixtures(){new TransactionTemplate(manager).execute(t->{jdbc.execute("select set_config('app.billing_mode','charge-relay',true)");jdbc.update("update billing_v2.charge_event_inbox set next_attempt_at=now()+interval '1 day' where status='PENDING'");return null;});}
 @Test void concurrentSourceReplayImportsOneFrozenChargeAndBillIssueReusesItWithoutRepricing()throws Exception{
  isolateChargeFixtures();var event=chargeEvent();when(chargeSource.reviewed(c,b,e,order,4)).thenAnswer(i->{assertFalse(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive());return performed();});
  var pool=Executors.newFixedThreadPool(6);try{var futures=new ArrayList<Future<Boolean>>();for(int n=0;n<12;n++)futures.add(pool.submit(()->charges.ingest("medical-v2-service",event).received()));int received=0;for(var f:futures)if(f.get(20,TimeUnit.SECONDS))received++;assertEquals(1,received);}finally{pool.shutdownNow();}
  verify(chargeSource,never()).reviewed(any(),any(),any(),any(),anyLong());charges.deliverBatch();assertEquals(1,count("charges"));assertEquals(0,count("bills"));assertEquals(0,count("journals"));UUID imported=local(()->jdbc.queryForObject("select id from billing_v2.charges",UUID.class));assertEquals("APPLIED",local(()->jdbc.queryForObject("select status from billing_v2.charge_event_inbox",String.class)));
  var newer=new BillingSources.Snapshot(UUID.randomUUID(),120000,"VND",price.effectiveFrom(),null,null);when(source.proof(any(),eq(c),eq(b),eq(e))).thenReturn(new BillingSources.Proof(e,patient,List.of(new BillingSources.Charge("MEDICAL_ORDER",order,offering,"Synthetic Performed Lab",newer))));assertThrows(ApiProblem.class,this::bill);assertEquals(0,count("bills"));assertEquals(0,count("journals"));assertEquals(100000,local(()->jdbc.queryForObject("select amount_vnd from billing_v2.charges",Long.class)));
  when(source.proof(any(),eq(c),eq(b),eq(e))).thenReturn(new BillingSources.Proof(e,patient,performed()));var issued=bill();assertEquals(imported,issued.lines().getFirst().chargeId());assertEquals(1,count("charges"));assertEquals(1,count("bill_lines"));assertEquals(1,count("journals"));
  var duplicate=chargeEvent();charges.ingest("medical-v2-service",duplicate);charges.deliverBatch();assertEquals(1,count("charges"));assertEquals(1,count("bills"));assertEquals(1,count("journals"));
 }
 @Test void sourceOutageAndChangedReplayDoNotAllocateChargesOrMoneyAndActualIngressRejectsWrongPeer(){
  isolateChargeFixtures();var event=chargeEvent();when(chargeSource.reviewed(c,b,e,order,4)).thenThrow(ApiProblem.dependency("Synthetic Medical proof unavailable"));assertTrue(charges.ingest("medical-v2-service",event).received());charges.deliverBatch();assertEquals(0,count("charges"));assertEquals(0,count("bills"));assertEquals(0,count("journals"));assertEquals("PENDING",local(()->jdbc.queryForObject("select status from billing_v2.charge_event_inbox",String.class)));
  var changed=event.deepCopy();changed.put("clinicid",UUID.randomUUID().toString());assertThrows(ApiProblem.class,()->charges.ingest("medical-v2-service",changed));var privateEvent=chargeEvent();((com.fasterxml.jackson.databind.node.ObjectNode)privateEvent.path("data")).put("diagnosis","Synthetic confidential");assertThrows(ApiProblem.class,()->charges.ingest("medical-v2-service",privateEvent));
  assertEquals(200,postCharge("medical-v2-service","billing-v2-service","billing.charge.consume",event));assertEquals(401,postCharge("other","billing-v2-service","billing.charge.consume",event));assertEquals(401,postCharge("medical-v2-service","other","billing.charge.consume",event));assertEquals(401,postCharge("medical-v2-service","billing-v2-service","billing.source.sync",event));assertEquals(403,postCharge("encounter-v2-service","billing-v2-service","billing.charge.consume",event));assertEquals(422,postCharge("medical-v2-service","billing-v2-service","billing.charge.consume",privateEvent));assertEquals(0,count("charges"));assertEquals(0,jdbc.queryForObject("select count(*) from billing_v2.charge_event_inbox",Integer.class));
 }
 int postCharge(String issuer,String audience,String scope,com.fasterxml.jackson.databind.JsonNode event){var now=Instant.now();String secret=issuer.equals("encounter-v2-service")?"synthetic-encounter-charge-source-secret-more-than-32-bytes":"synthetic-medical-charge-source-secret-more-than-32-bytes";String token=io.jsonwebtoken.Jwts.builder().issuer(issuer).subject(issuer).audience().add(audience).and().id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",List.of(scope)).issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(30))).signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8))).compact();var headers=new org.springframework.http.HttpHeaders();headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);headers.setBearerAuth(token);return http.postForEntity("/api/v2/internal/charges/events",new org.springframework.http.HttpEntity<>(event,headers),String.class).getStatusCode().value();}
 @Test void reclaimedChargeLeaseRejectsOldWorkerAndOnlyImportsThroughTheCurrentClaim(){
  isolateChargeFixtures();charges.ingest("medical-v2-service",chargeEvent());var first=charges.claim();assertNotNull(first);assertNull(charges.claim());local(()->jdbc.update("update billing_v2.charge_event_inbox set lease_until=now()-interval '1 second'"));var second=charges.claim();assertNotEquals(first.lease(),second.lease());assertFalse(charges.apply(first,performed()));assertEquals(0,count("charges"));assertTrue(charges.apply(second,performed()));assertEquals(1,count("charges"));assertEquals(0,count("bills"));assertEquals(0,count("journals"));
 }
 Bill bill(){return s.issue(cashier,c,b,"issue",new IssueInput(e,"Synthetic completed care"));}
 Shift shift(Actor actor){return s.open(actor,c,b,"open",new ShiftInput("Synthetic shift open"));}
 @Test void patientPortalUsesAuthoritativeIdentityOutsideTransactionAndOmitsCashierReferences()throws Exception{
  var billed=bill();var shift=shift(cashier);s.collect(cashier,c,b,billed.id(),"bank",new PaymentInput(0,shift.id(),40000,"BANK_TRANSFER","SYN-PRIVATE-BANK-REF","Private cashier reason"));
  var actor=new Actor(UUID.randomUUID(),Set.of("ROLE_USER"),"Bearer synthetic-patient");assertNotEquals(actor.id(),patient);
  when(patientIdentity.ownPatient(actor,c)).thenAnswer(i->{assertFalse(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive());return patient;});
  var own=portal.read(actor,c,b,billed.id());assertEquals(40000,own.paidVnd());assertEquals(60000,own.remainingVnd());assertEquals(1,own.receipts().size());assertTrue(own.receipts().getFirst().label().contains("KHÔNG PHẢI HÓA ĐƠN THUẾ"));
  String publicJson=new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().writeValueAsString(own);for(String secret:List.of("SYN-PRIVATE-BANK-REF","Private cashier reason","collectorUserId","shiftId","patientId","sourceId"))assertFalse(publicJson.contains(secret));
  verify(iam,never()).decide(eq(actor.id()),anyString(),any(),any());assertEquals(1,portal.list(actor,c,b).size());
 }
 @Test void patientPortalRejectsOtherPatientBranchAndRevokedSourceWithoutLeakingRows(){
  var mine=bill();var actor=new Actor(UUID.randomUUID(),Set.of("ROLE_USER"),"Bearer synthetic-patient");when(patientIdentity.ownPatient(actor,c)).thenReturn(UUID.randomUUID());assertTrue(portal.list(actor,c,b).isEmpty());assertThrows(ApiProblem.class,()->portal.read(actor,c,b,mine.id()));
  when(patientIdentity.ownPatient(actor,c)).thenReturn(patient);assertTrue(portal.list(actor,c,UUID.randomUUID()).isEmpty());assertThrows(ApiProblem.class,()->portal.read(actor,c,UUID.randomUUID(),mine.id()));
  when(patientIdentity.ownPatient(actor,c)).thenThrow(ApiProblem.forbidden());assertThrows(ApiProblem.class,()->portal.list(actor,c,b));assertThrows(ApiProblem.class,()->portal.read(actor,c,b,mine.id()));
  assertEquals(0,jdbc.queryForObject("select count(*) from billing_v2.bills",Integer.class));
 }
 @Test void concurrentIssueCreatesOneFrozenChargeBillAndBalancedJournal()throws Exception{
  var pool=Executors.newFixedThreadPool(6);try{List<Future<Bill>> results=new ArrayList<>();for(int n=0;n<12;n++)results.add(pool.submit(this::bill));Set<UUID> ids=new HashSet<>();for(var f:results)ids.add(f.get(20,TimeUnit.SECONDS).id());assertEquals(1,ids.size());}finally{pool.shutdownNow();}
  assertEquals(1,count("bills"));assertEquals(1,count("charges"));assertEquals(1,count("bill_lines"));assertEquals(1,count("journals"));assertEquals(2,count("journal_lines"));assertEquals(1,count("outbox_events"));var current=bill();assertEquals(100000,current.subtotalVnd());
  when(source.proof(any(),eq(c),eq(b),eq(e))).thenThrow(ApiProblem.dependency("Later source unavailable"));assertEquals(current.id(),bill().id());assertEquals(current.id(),s.issue(cashier,c,b,"other-issue",new IssueInput(e,"Explicit later read")).id());
  assertThrows(ApiProblem.class,()->s.issue(cashier,c,b,"issue",new IssueInput(e,"Changed key data")));
  local(()->{assertEquals(100000,jdbc.queryForObject("select amount_vnd from billing_v2.charges",Long.class));assertEquals(0L,jdbc.queryForObject("select sum(case when side='D' then amount_vnd else -amount_vnd end) from billing_v2.journal_lines",Long.class));return null;});
 }
 @Test void twoCollectorsCannotOverpayOneBill()throws Exception{
  var bill=bill();var one=shift(cashier);var two=shift(other);var pool=Executors.newFixedThreadPool(2);var start=new CyclicBarrier(2);
  try{var futures=new ArrayList<Future<Boolean>>();for(var pair:List.of(Map.entry(cashier,one),Map.entry(other,two)))futures.add(pool.submit(()->{start.await();try{s.collect(pair.getKey(),c,b,bill.id(),"full",new PaymentInput(0,pair.getValue().id(),100000,"CASH",null,"Synthetic competing full collection"));return true;}catch(ApiProblem ex){return false;}}));int won=0;for(var f:futures)if(f.get(20,TimeUnit.SECONDS))won++;assertEquals(1,won);}finally{pool.shutdownNow();}
  assertEquals(1,count("payments"));assertEquals("PAID",s.read(cashier,c,b,bill.id()).status());assertEquals(0,s.read(cashier,c,b,bill.id()).remainingVnd());assertEquals(2,count("journals"));
 }
 @Test void partialPaymentApprovedReductionAndReceiptKeepSeparateHistory(){
  var bill=bill();var shift=shift(cashier);var cash=s.collect(cashier,c,b,bill.id(),"partial",new PaymentInput(0,shift.id(),40000,"CASH",null,"Synthetic cash"));
  assertTrue(cash.label().contains("KHÔNG PHẢI HÓA ĐƠN THUẾ"));var current=s.read(cashier,c,b,bill.id());assertEquals("PARTIALLY_PAID",current.status());assertEquals(60000,current.remainingVnd());
  assertThrows(ApiProblem.class,()->s.adjust(cashier,c,b,bill.id(),"denied",new AdjustmentInput(1,20000,"Cashier cannot approve reduction")));
  var adjusted=s.adjust(managerActor,c,b,bill.id(),"adjust",new AdjustmentInput(1,20000,"Synthetic authorized reduction"));assertEquals(40000,adjusted.remainingVnd());
  assertThrows(ApiProblem.class,()->s.adjust(managerActor,c,b,bill.id(),"too-much",new AdjustmentInput(adjusted.version(),50000,"Cannot reduce below already paid")));
  assertThrows(ApiProblem.class,()->s.collect(cashier,c,b,bill.id(),"no-ref",new PaymentInput(adjusted.version(),shift.id(),40000,"POS",null,"Missing verified tender reference")));
  s.collect(cashier,c,b,bill.id(),"pos",new PaymentInput(adjusted.version(),shift.id(),40000,"POS","SYN-POS-001","Synthetic terminal-confirmed tender"));assertEquals("PAID",s.read(cashier,c,b,bill.id()).status());assertEquals(2,s.payments(cashier,c,b,bill.id()).size());assertEquals(1,count("adjustments"));assertEquals(4,count("journals"));assertEquals(8,count("journal_lines"));
 }
 @Test void paymentRetryWorksAfterShiftSubmissionWithoutDuplicateEffect(){
  var bill=bill();var shift=shift(cashier);var input=new PaymentInput(0,shift.id(),100000,"BANK_TRANSFER","SYN-BANK-001","Synthetic verified transfer");var receipt=s.collect(cashier,c,b,bill.id(),"bank",input);
  var submitted=s.submit(cashier,c,b,shift.id(),"submit",new ShiftSubmit(0,0,99900,0,"Synthetic declared count"));assertEquals(-100,submitted.varianceVnd());
  assertEquals(receipt.id(),s.collect(cashier,c,b,bill.id(),"bank",input).id());assertEquals(1,count("payments"));
  assertThrows(ApiProblem.class,()->s.collect(cashier,c,b,bill.id(),"bank",new PaymentInput(0,shift.id(),100000,"BANK_TRANSFER","CHANGED","Changed reference")));
  assertThrows(ApiProblem.class,()->s.approve(cashier,c,b,shift.id(),"approve",new ApproveInput(submitted.version(),"Cashier has no approval role")));
  assertEquals("APPROVED",s.approve(managerActor,c,b,shift.id(),"approve",new ApproveInput(submitted.version(),"Synthetic variance acknowledged")).state());assertEquals(receipt.id(),s.payments(cashier,c,b,bill.id()).getFirst().id());
 }
 @Test void managerCannotApproveOwnShiftOrCollectInSomeoneElsesShift(){
  var bill=bill();var own=shift(managerActor);assertThrows(ApiProblem.class,()->s.collect(cashier,c,b,bill.id(),"wrong-shift",new PaymentInput(0,own.id(),100000,"CASH",null,"Wrong collector")));
  var submitted=s.submit(managerActor,c,b,own.id(),"submit",new ShiftSubmit(0,0,0,0,"No tender"));assertThrows(ApiProblem.class,()->s.approve(managerActor,c,b,own.id(),"approve",new ApproveInput(submitted.version(),"Self approval denied")));
 }
 @Test void repeatedExternalTenderCannotFundAnotherBill(){
  var first=bill();var shift=shift(cashier);s.collect(cashier,c,b,first.id(),"bank",new PaymentInput(0,shift.id(),100000,"BANK_TRANSFER","SYN-REF","Verified tender"));
  UUID next=UUID.randomUUID();when(source.proof(cashier,c,b,next)).thenReturn(new BillingSources.Proof(next,patient,List.of(new BillingSources.Charge("MEDICAL_ORDER",UUID.randomUUID(),offering,"Synthetic second service",price))));var second=s.issue(cashier,c,b,"second",new IssueInput(next,"Second completed care"));
  assertThrows(org.springframework.dao.DataAccessException.class,()->s.collect(cashier,c,b,second.id(),"duplicate-ref",new PaymentInput(0,shift.id(),100000,"BANK_TRANSFER","SYN-REF","Repeated tender reference")));
  assertEquals(0,s.read(cashier,c,b,second.id()).paidVnd());assertEquals(1,count("payments"));assertEquals(3,count("journals"));
 }
 @Test void databaseRejectsUnbalancedOrLateJournalLinesAndPaymentHistoryRewrite(){
  UUID journal=UUID.randomUUID();
  assertThrows(RuntimeException.class,()->local(()->{jdbc.update("insert into billing_v2.journals(id,clinic_id,branch_id,source_type,source_id,actor_user_id,reason) values(?,?,?,'BILL',?,?,'Unbalanced attempt')",journal,c,b,e,cashier.id());jdbc.update("insert into billing_v2.journal_lines(id,clinic_id,branch_id,journal_id,account,side,amount_vnd) values(?,?,?,?,'CASH','D',100)",UUID.randomUUID(),c,b,journal);return null;}));assertEquals(0,count("journals"));
  var bill=bill();UUID old=local(()->jdbc.queryForObject("select id from billing_v2.journals",UUID.class));assertThrows(RuntimeException.class,()->local(()->{jdbc.update("insert into billing_v2.journal_lines(id,clinic_id,branch_id,journal_id,account,side,amount_vnd) values(?,?,?,?,'CASH','D',100)",UUID.randomUUID(),c,b,old);return null;}));assertEquals(2,count("journal_lines"));
  var shift=shift(cashier);s.collect(cashier,c,b,bill.id(),"cash",new PaymentInput(0,shift.id(),100000,"CASH",null,"Synthetic collection"));
  assertThrows(org.springframework.dao.DataAccessException.class,()->local(()->{jdbc.update("update billing_v2.payments set amount_vnd=1");return null;}));
  assertThrows(org.springframework.dao.DataAccessException.class,()->local(()->{jdbc.update("delete from billing_v2.journal_lines");return null;}));
 }
 @Test void scopeRevokeAndFailedSourceDoNotIssueOrExposeBills(){
  when(source.proof(any(),eq(c),eq(b),eq(e))).thenThrow(ApiProblem.dependency("Synthetic source outage"));assertThrows(ApiProblem.class,this::bill);assertEquals(0,count("bills"));assertEquals(0,count("journals"));
  when(source.proof(any(),eq(c),eq(b),eq(e))).thenReturn(new BillingSources.Proof(e,patient,List.of(new BillingSources.Charge("MEDICAL_ORDER",order,offering,"Synthetic service",price))));var bill=bill();assertEquals(0,jdbc.queryForObject("select count(*) from billing_v2.bills",Integer.class));assertThrows(ApiProblem.class,()->s.read(cashier,c,UUID.randomUUID(),bill.id()));
  when(iam.decide(cashier.id(),"BILLING",c,b)).thenReturn(new IamAuthorizationClient.Decision(false,null,null,2,"Revoked"));assertThrows(ApiProblem.class,()->s.read(cashier,c,b,bill.id()));
  var role=jdbc.queryForMap("select rolsuper,rolbypassrls from pg_roles where rolname=current_user");assertEquals(false,role.get("rolsuper"));assertEquals(false,role.get("rolbypassrls"));
 }
 @Test void emptyPerformedServiceProofCreatesZeroBillWithoutInventingFee(){
  when(source.proof(any(),eq(c),eq(b),eq(e))).thenReturn(new BillingSources.Proof(e,patient,List.of()));var bill=bill();assertEquals(0,bill.subtotalVnd());assertEquals("PAID",bill.status());assertEquals(0,count("journals"));assertEquals(0,count("charges"));var shift=shift(cashier);assertThrows(ApiProblem.class,()->s.collect(cashier,c,b,bill.id(),"phantom",new PaymentInput(0,shift.id(),1,"CASH",null,"No invented fee")));
 }
}
