package com.clinic.v2.appointment;
import com.clinic.v2.appointment.api.*;
import com.clinic.v2.appointment.api.AppointmentDto.*;
import com.clinic.v2.appointment.security.*;
import com.clinic.v2.appointment.service.AppointmentService;
import com.clinic.v2.appointment.source.*;
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
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@SpringBootTest(properties={"appointment.security.workload-secret=synthetic-appointment-secret-at-least-32-bytes","appointment.security.billing-secret=synthetic-source-proof-secret-at-least-32-bytes"})
@EnabledIfSystemProperty(named="appointment.it.enabled",matches="true")
class AppointmentPostgresTest{
 @Autowired com.clinic.v2.appointment.api.BillingProofController billingProof;
 String billingToken(String scope){var now=Instant.now();return "Bearer "+io.jsonwebtoken.Jwts.builder().issuer("billing-v2-service").subject("billing-v2-service").audience().add("appointment-v2-service").and().id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",List.of(scope)).issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(30))).signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor("synthetic-source-proof-secret-at-least-32-bytes".getBytes(java.nio.charset.StandardCharsets.UTF_8))).compact();}
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired AppointmentService service;@Autowired TenantDbContext db;
 @Autowired com.clinic.v2.appointment.service.ArrivalService arrivals;@Autowired com.clinic.v2.appointment.service.FulfillmentService fulfillment;
 @Autowired com.clinic.v2.appointment.service.ReceptionExceptionService exceptions;
 @Autowired com.clinic.v2.appointment.service.AbsenceConsumer absenceConsumer;
 @Autowired JdbcTemplate jdbc;@Autowired PlatformTransactionManager manager;@Autowired ObjectMapper json;
 @MockBean ClinicSourceClient clinic;@MockBean PatientSourceClient patient;
 @MockBean DoctorSourceClient doctor;@MockBean CatalogSourceClient catalog;
 @MockBean FollowUpSources followUpSources;@Autowired com.clinic.v2.appointment.service.FollowUpBookingService followUp;
 UUID clinicId,branchId,offeringId,doctorId,patientId,userId;Actor actor;
 LocalDate date=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(2);
 DoctorSourceClient.Doctor sourceDoctor;CatalogSourceClient.Offering sourceOffering;
 @BeforeEach void fixture(){
  clinicId=UUID.randomUUID();branchId=UUID.randomUUID();offeringId=UUID.randomUUID();doctorId=UUID.randomUUID();
  patientId=UUID.randomUUID();userId=UUID.randomUUID();actor=new Actor(userId,Set.of("ROLE_PATIENT"));
  sourceDoctor=new DoctorSourceClient.Doctor(doctorId,clinicId,branchId,"Synthetic Doctor","GEN","Synthetic",null,1,
   List.of(new DoctorSourceClient.Schedule(date.getDayOfWeek().getValue(),LocalTime.of(8,0),LocalTime.of(17,0),
    "Asia/Ho_Chi_Minh",date.minusDays(1),date.plusDays(1),2)));
  sourceOffering=new CatalogSourceClient.Offering(offeringId,clinicId,branchId,"SYN","Synthetic offering",null,"GEN",30,
    100000,"VND",UUID.randomUUID(),Instant.now().minusSeconds(3600),null,null,1,2);
  when(clinic.requireEligible(clinicId,branchId)).thenReturn(new ClinicSourceClient.BookingEligibility(clinicId,true,1));
  when(doctor.requireDoctor(clinicId,branchId,doctorId)).thenReturn(sourceDoctor);
  when(catalog.requireOffering(clinicId,branchId,offeringId)).thenReturn(sourceOffering);
  when(patient.booking(patientId)).thenReturn(new PatientSourceClient.BookingIdentity(patientId,userId,true));
  when(patient.clinicLink(patientId,clinicId)).thenReturn(new PatientSourceClient.ClinicLink(UUID.randomUUID(),clinicId,patientId,"SYN","VERIFIED",0));
 }
 List<AvailabilitySlot> availability(){return service.availability(clinicId,branchId,offeringId,doctorId,date);}
 HoldInput input(UUID slot){return new HoldInput(clinicId,branchId,offeringId,doctorId,slot,patientId);}
 HoldView hold(UUID slot,String key){return service.hold(actor,key,input(slot));}
 <T>T tenant(Supplier<T> action){return new TransactionTemplate(manager).execute(s->{db.tenant(clinicId);return action.get();});}
 AppointmentView confirm(HoldView h){return service.confirm(actor,"confirm-"+h.holdId(),new ConfirmInput(clinicId,h.holdId(),patientId));}
 @Test void backgroundAbsenceBatchesAndCancellationReplayPreserveThirteenBookings()throws Exception{
  var slots=availability();var bookings=new ArrayList<AppointmentView>();for(int n=0;n<13;n++)bookings.add(confirm(hold(slots.get(n).slotId(),"batch-"+n)));
  UUID absence=UUID.randomUUID(),staff=UUID.randomUUID();var start=slots.getFirst().startsAt();var end=slots.get(12).endsAt();var active=new com.clinic.v2.appointment.service.AbsenceConsumer.Input(UUID.randomUUID(),absence,clinicId,branchId,doctorId,start,end,1,"ACTIVE",staff);
  assertFalse(absenceConsumer.accept(active).complete());assertTrue(absenceConsumer.accept(active).complete());assertTrue(absenceConsumer.accept(active).complete());
  var cancelled=new com.clinic.v2.appointment.service.AbsenceConsumer.Input(UUID.randomUUID(),absence,clinicId,branchId,doctorId,start,end,2,"CANCELLED",staff);
  assertFalse(absenceConsumer.accept(cancelled).complete());assertTrue(absenceConsumer.accept(cancelled).complete());assertTrue(absenceConsumer.accept(active).complete());assertTrue(absenceConsumer.accept(cancelled).complete());
  for(var booking:bookings){assertEquals("CONFIRMED",arrivals.read(clinicId,branchId,booking.id()).status());assertEquals("RESOLVED",exceptions.list(clinicId,branchId,booking.id()).getFirst().state());assertEquals(100000,service.mine(actor,clinicId,patientId).stream().filter(x->x.id().equals(booking.id())).findFirst().orElseThrow().price().amountVnd());}
  tenant(()->{assertEquals(13,jdbc.queryForObject("select count(*) from appointment_v2.exception_resolution_commands",Integer.class));assertEquals(13,jdbc.queryForObject("select count(*) from appointment_v2.outbox_events where event_type='clinic.appointment.exception_resolved.v1'",Integer.class));return null;});assertEquals(0,jdbc.queryForObject("select count(*) from appointment_v2.absence_progress",Integer.class));
  assertThrows(ApiProblem.class,()->absenceConsumer.accept(new com.clinic.v2.appointment.service.AbsenceConsumer.Input(UUID.randomUUID(),absence,clinicId,UUID.randomUUID(),doctorId,start,end,2,"CANCELLED",staff)));
 }
 @Test void overlappingAbsenceResolutionKeepsAttentionUntilBothSourcesCancelled(){
  var slot=availability().getFirst();var booking=confirm(hold(slot.slotId(),"overlap"));UUID first=UUID.randomUUID(),second=UUID.randomUUID(),staff=UUID.randomUUID();
  absenceConsumer.accept(new com.clinic.v2.appointment.service.AbsenceConsumer.Input(UUID.randomUUID(),first,clinicId,branchId,doctorId,slot.startsAt(),slot.endsAt(),1,"ACTIVE",staff));absenceConsumer.accept(new com.clinic.v2.appointment.service.AbsenceConsumer.Input(UUID.randomUUID(),second,clinicId,branchId,doctorId,slot.startsAt(),slot.endsAt(),1,"ACTIVE",staff));
  var exception=exceptions.list(clinicId,branchId,booking.id()).getFirst();var current=arrivals.read(clinicId,branchId,booking.id());assertThrows(ApiProblem.class,()->exceptions.resolve(clinicId,branchId,booking.id(),exception.id(),"unsafe",new com.clinic.v2.appointment.service.ReceptionExceptionService.ResolveInput(staff,current.version(),"Acknowledgement cannot bypass active source")));
  absenceConsumer.accept(new com.clinic.v2.appointment.service.AbsenceConsumer.Input(UUID.randomUUID(),first,clinicId,branchId,doctorId,slot.startsAt(),slot.endsAt(),2,"CANCELLED",staff));
  tenant(()->{String payload=jdbc.queryForObject("select payload_json from appointment_v2.outbox_events where event_type='clinic.appointment.exception_resolved.v1'",String.class);assertTrue(payload.contains("ATTENTION_REQUIRED"));return null;});
  assertEquals(1,exceptions.list(clinicId,branchId,booking.id()).stream().filter(x->"OPEN".equals(x.state())).count());absenceConsumer.accept(new com.clinic.v2.appointment.service.AbsenceConsumer.Input(UUID.randomUUID(),second,clinicId,branchId,doctorId,slot.startsAt(),slot.endsAt(),2,"CANCELLED",staff));assertTrue(exceptions.list(clinicId,branchId,booking.id()).stream().allMatch(x->"RESOLVED".equals(x.state())));
 }
 @Test void cancelledPatientBookingCanResolveExceptionWithOneConcurrentEffect()throws Exception{
  var booking=confirm(hold(availability().getFirst().slotId(),"manual-resolution"));UUID staff=UUID.randomUUID();var exception=exceptions.record(clinicId,branchId,booking.id(),"manual-absent",new com.clinic.v2.appointment.service.ReceptionExceptionService.Input(staff,0,"DOCTOR_ABSENT","Synthetic manual absence"));service.cancel(actor,booking.id(),new CancelInput(clinicId,patientId,"Synthetic own cancellation","cancel"));var current=arrivals.read(clinicId,branchId,booking.id());var input=new com.clinic.v2.appointment.service.ReceptionExceptionService.ResolveInput(staff,current.version(),"Cancelled source verified");
  var pool=Executors.newFixedThreadPool(4);try{var futures=new ArrayList<Future<com.clinic.v2.appointment.service.ReceptionExceptionService.View>>();for(int n=0;n<8;n++)futures.add(pool.submit(()->exceptions.resolve(clinicId,branchId,booking.id(),exception.id(),"same-resolution",input)));for(var f:futures)assertEquals("RESOLVED",f.get(20,TimeUnit.SECONDS).state());}finally{pool.shutdownNow();}
  assertEquals("CANCELLED",arrivals.read(clinicId,branchId,booking.id()).status());assertThrows(ApiProblem.class,()->exceptions.resolve(clinicId,branchId,booking.id(),exception.id(),"same-resolution",new com.clinic.v2.appointment.service.ReceptionExceptionService.ResolveInput(staff,input.expectedVersion(),"Changed")));
  tenant(()->{assertEquals(1,jdbc.queryForObject("select count(*) from appointment_v2.exception_resolution_commands",Integer.class));return null;});
 }
 @Test void billingSystemProofRequiresBoundArrivalAndDedicatedPeerScope(){
  var booking=confirm(hold(availability().getFirst().slotId(),"billing-source"));assertThrows(ApiProblem.class,()->billingProof.systemProof(billingToken("billing.source.sync"),clinicId,branchId,booking.id()));UUID encounter=UUID.randomUUID();tenant(()->{jdbc.update("update appointment_v2.appointments set status='CHECKED_IN',encounter_id=? where id=?",encounter,booking.id());return null;});
  assertThrows(ApiProblem.class,()->billingProof.systemProof(billingToken("billing.source.read"),clinicId,branchId,booking.id()));assertThrows(ApiProblem.class,()->billingProof.systemProof("Bearer invalid",clinicId,branchId,booking.id()));assertThrows(ApiProblem.class,()->billingProof.systemProof(billingToken("billing.source.sync"),clinicId,UUID.randomUUID(),booking.id()));
  var proof=billingProof.systemProof(billingToken("billing.source.sync"),clinicId,branchId,booking.id());assertEquals(encounter,proof.encounterId());assertEquals(patientId,proof.patientId());assertEquals(100000,proof.price().amountVnd());assertEquals(booking.price().priceVersionId(),proof.price().priceVersionId());
 }
 @Test void followUpCreatesDistinctBookingWithImmutableSourceLinkAndReplaySurvivesProofOutage()throws Exception{
  var slots=availability();var old=confirm(hold(slots.getFirst().slotId(),"old"));UUID prior=UUID.randomUUID();
  tenant(()->{jdbc.update("update appointment_v2.appointments set status='CHECKED_IN',encounter_id=? where id=?",prior,old.id());return null;});
  fulfillment.accept(clinicId,branchId,old.id(),new com.clinic.v2.appointment.service.FulfillmentService.Input(UUID.randomUUID(),prior,userId));
  var in=new FollowUpInput(clinicId,branchId,offeringId,doctorId,slots.get(1).slotId(),patientId,prior,branchId);
  when(followUpSources.proof("Bearer synthetic",in)).thenAnswer(i->{assertFalse(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive());return new FollowUpSources.Proof(prior,branchId,patientId,7,date);});
  var executor=Executors.newFixedThreadPool(4);Set<UUID> ids=new HashSet<>();try{var pending=new ArrayList<Future<HoldView>>();for(int n=0;n<8;n++)pending.add(executor.submit(()->followUp.hold(actor,"Bearer synthetic","follow-up",in)));for(var f:pending)ids.add(f.get(20,TimeUnit.SECONDS).holdId());}finally{executor.shutdownNow();}assertEquals(1,ids.size());
  var held=followUp.hold(actor,"Bearer synthetic","follow-up",in);reset(followUpSources);when(followUpSources.proof(anyString(),any())).thenThrow(ApiProblem.dependency("Later Medical source outage"));assertEquals(held.holdId(),followUp.hold(actor,"Bearer synthetic","follow-up",in).holdId());verifyNoInteractions(followUpSources);
  var booked=confirm(held);assertNotEquals(old.id(),booked.id());assertEquals(prior,booked.priorEncounterId());assertEquals(branchId,booked.priorBranchId());assertEquals(held.price().priceVersionId(),booked.price().priceVersionId());
  tenant(()->{var source=jdbc.queryForMap("select prior_medical_version,prior_proposed_date from appointment_v2.appointments where id=?",booked.id());assertEquals(7L,((Number)source.get("prior_medical_version")).longValue());assertEquals(date,((java.sql.Date)source.get("prior_proposed_date")).toLocalDate());assertEquals("FULFILLED",jdbc.queryForObject("select status from appointment_v2.appointments where id=?",String.class,old.id()));return null;});
  assertThrows(ApiProblem.class,()->followUp.hold(actor,"Bearer synthetic","follow-up",new FollowUpInput(clinicId,branchId,offeringId,doctorId,slots.get(1).slotId(),patientId,UUID.randomUUID(),branchId)));
  assertThrows(org.springframework.dao.DataAccessException.class,()->tenant(()->{jdbc.update("update appointment_v2.appointments set prior_encounter_id=? where id=?",UUID.randomUUID(),booked.id());return null;}));
 }
 @Test void followUpRejectsWrongPatientOrMissingProofWithoutAllocatingHold(){
  var slot=availability().getFirst().slotId();var in=new FollowUpInput(clinicId,branchId,offeringId,doctorId,slot,patientId,UUID.randomUUID(),branchId);
  assertThrows(ApiProblem.class,()->followUp.hold(new Actor(UUID.randomUUID(),Set.of("ROLE_USER")),"Bearer synthetic","wrong-user",in));verifyNoInteractions(followUpSources);
  when(followUpSources.proof(anyString(),eq(in))).thenThrow(ApiProblem.dependency("Source unavailable"));assertThrows(ApiProblem.class,()->followUp.hold(actor,"Bearer synthetic","source-fail",in));assertEquals(0,tenant(()->jdbc.queryForObject("select count(*) from appointment_v2.slot_reservations",Integer.class)));
 }
 @Test void databaseRejectsPartialFollowUpProofWithNullVersion(){
  var held=hold(availability().getFirst().slotId(),"normal");
  assertThrows(org.springframework.dao.DataAccessException.class,()->tenant(()->{jdbc.update("insert into appointment_v2.slot_reservations(id,slot_id,clinic_id,branch_id,patient_id,price_version_id,amount_vnd,currency,price_effective_from,state,expires_at,idempotency_key,payload_hash,prior_encounter_id,prior_branch_id,prior_medical_version,prior_proposed_date) select gen_random_uuid(),slot_id,clinic_id,branch_id,patient_id,price_version_id,amount_vnd,currency,price_effective_from,state,expires_at,'incomplete-proof',payload_hash,?,branch_id,null,? from appointment_v2.slot_reservations where id=?",UUID.randomUUID(),date,held.holdId());return null;}));
 }
 @Test void fulfillmentIsSourceEncounterBoundAndConcurrentReplayHasOneHistoryEffect()throws Exception{
  var booking=confirm(hold(availability().getFirst().slotId(),"fulfillment"));UUID encounter=UUID.randomUUID(),event=UUID.randomUUID();
  tenant(()->{jdbc.update("update appointment_v2.appointments set status='CHECKED_IN',encounter_id=? where id=?",encounter,booking.id());return null;});
  var input=new com.clinic.v2.appointment.service.FulfillmentService.Input(event,encounter,userId);var pool=Executors.newFixedThreadPool(6);
  try{List<Future<String>> results=new ArrayList<>();for(int n=0;n<12;n++)results.add(pool.submit(()->fulfillment.accept(clinicId,branchId,booking.id(),input).status()));for(var f:results)assertEquals("FULFILLED",f.get(20,TimeUnit.SECONDS));}finally{pool.shutdownNow();}
  tenant(()->{assertEquals(1,jdbc.queryForObject("select count(*) from appointment_v2.fulfillment_receipts where appointment_id=?",Integer.class,booking.id()));assertEquals(1,jdbc.queryForObject("select count(*) from appointment_v2.appointment_history where appointment_id=? and to_status='FULFILLED'",Integer.class,booking.id()));assertNotNull(jdbc.queryForObject("select fulfilled_at from appointment_v2.appointments where id=?",java.sql.Timestamp.class,booking.id()));return null;});
  assertThrows(ApiProblem.class,()->fulfillment.accept(clinicId,branchId,booking.id(),new com.clinic.v2.appointment.service.FulfillmentService.Input(event,UUID.randomUUID(),userId)));
  assertThrows(ApiProblem.class,()->fulfillment.accept(clinicId,branchId,booking.id(),new com.clinic.v2.appointment.service.FulfillmentService.Input(event,encounter,UUID.randomUUID())));
  assertThrows(ApiProblem.class,()->fulfillment.accept(clinicId,UUID.randomUUID(),booking.id(),input));
  assertEquals(booking.price(),service.mine(actor,clinicId,patientId).stream().filter(a->a.id().equals(booking.id())).findFirst().orElseThrow().price());
 }
 @Test void confirmedAppointmentCannotBeFulfilledWithoutSourceArrival(){
  var booking=confirm(hold(availability().getFirst().slotId(),"not-arrived"));
  assertThrows(ApiProblem.class,()->fulfillment.accept(clinicId,branchId,booking.id(),new com.clinic.v2.appointment.service.FulfillmentService.Input(UUID.randomUUID(),UUID.randomUUID(),userId)));
  assertEquals("CONFIRMED",arrivals.read(clinicId,branchId,booking.id()).status());
 }
 @Test void twoConcurrentRequestsAndFiftyAttemptsAllocateOnlyOneHold()throws Exception{
  for(int attempts:new int[]{2,50}){
   UUID slot=availability().get(attempts==2?0:1).slotId();
   var executor=Executors.newFixedThreadPool(Math.min(8,attempts));var start=new CountDownLatch(1);
   try{
    List<Future<Boolean>> results=new ArrayList<>();
    for(int i=0;i<attempts;i++){String key=UUID.randomUUID().toString();
     results.add(executor.submit(()->{start.await();try{hold(slot,key);return true;}catch(ApiProblem ex){assertEquals("SLOT_UNAVAILABLE",ex.code);return false;}}));}
    start.countDown();int won=0;
    for(var result:results)if(result.get(45,TimeUnit.SECONDS))won++;
    assertEquals(1,won);
    assertEquals(1,tenant(()->jdbc.queryForObject("select count(*) from appointment_v2.slot_reservations where slot_id=? and state='ACTIVE'",Integer.class,slot)));
   }finally{executor.shutdownNow();}
  }
 }
 @Test void simultaneousSameIdempotencyKeyReturnsOriginal()throws Exception{
  UUID slot=availability().get(0).slotId();var executor=Executors.newFixedThreadPool(2);var barrier=new CyclicBarrier(2);
  try{
   var a=executor.submit(()->{barrier.await();return hold(slot,"same");});
   var b=executor.submit(()->{barrier.await();return hold(slot,"same");});
   assertEquals(a.get(20,TimeUnit.SECONDS).holdId(),b.get(20,TimeUnit.SECONDS).holdId());
   assertThrows(ApiProblem.class,()->hold(availability().get(0).slotId(),"same"));
  }finally{executor.shutdownNow();}
 }
 @Test void priceLockedAtHoldAndOutboxCommittedWithStableEventId()throws Exception{
  var h=hold(availability().get(0).slotId(),"price");
  when(catalog.requireOffering(clinicId,branchId,offeringId)).thenReturn(new CatalogSourceClient.Offering(offeringId,clinicId,branchId,
    "SYN","Synthetic",null,"GEN",30,200000,"VND",UUID.randomUUID(),Instant.now(),null,null,1,2));
  var a=confirm(h);assertEquals(100000,a.price().amountVnd());assertEquals(h.price().priceVersionId(),a.price().priceVersionId());
  assertEquals(a.id(),confirm(h).id());
  var row=tenant(()->jdbc.queryForMap("select event_id,payload_json from appointment_v2.outbox_events where aggregate_id=?",a.id()));
  assertEquals(row.get("event_id").toString(),json.readTree(row.get("payload_json").toString()).get("id").asText());
  assertEquals(0,jdbc.queryForObject("select count(*) from appointment_v2.appointments",Integer.class));
  var role=jdbc.queryForMap("select rolsuper,rolbypassrls from pg_roles where rolname=current_user");
  assertEquals(false,role.get("rolsuper"));assertEquals(false,role.get("rolbypassrls"));
 }
 @Test void cancellationReleasesCapacityAndIsIdempotent(){
  var h=hold(availability().get(0).slotId(),"cancel");var a=confirm(h);
  var input=new CancelInput(clinicId,patientId,"Synthetic cancellation","test-cancel");
  assertEquals("CANCELLED",service.cancel(actor,a.id(),input).status());
  assertEquals("CANCELLED",service.cancel(actor,a.id(),input).status());
  assertTrue(availability().stream().anyMatch(s->s.slotId().equals(h.slotId())));
  assertEquals(2,tenant(()->jdbc.queryForObject("select count(*) from appointment_v2.outbox_events where aggregate_id=?",Integer.class,a.id())));
 }
 @Test void scheduleEndingAtMidnightIncludesItsLastWholeSlot(){
  var d=new DoctorSourceClient.Doctor(doctorId,clinicId,branchId,"Synthetic","GEN","Synthetic",null,1,List.of(new DoctorSourceClient.Schedule(date.getDayOfWeek().getValue(),LocalTime.of(23,0),LocalTime.MIDNIGHT,"Asia/Ho_Chi_Minh",date.minusDays(1),date.plusDays(1),2)));
  when(doctor.requireDoctor(clinicId,branchId,doctorId)).thenReturn(d);
  var slots=availability();assertEquals(2,slots.size());assertEquals(LocalTime.of(23,30),slots.getLast().startsAt().atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toLocalTime());
  assertEquals("CONFIRMED",confirm(hold(slots.getLast().slotId(),"midnight")).status());
 }
 @Test void relayRetriesConsumersIndependentlyWithoutReSendingAcknowledgedNotification()throws Exception{
  var a=confirm(hold(availability().getFirst().slotId(),"relay"));
  var notifications=new java.util.concurrent.atomic.AtomicInteger();var audits=new java.util.concurrent.atomic.AtomicInteger();
  var server=com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1",0),0);
  server.createContext("/api/v2/internal/notifications/events",x->{x.getRequestBody().readAllBytes();x.sendResponseHeaders(notifications.incrementAndGet()==1?503:200,-1);x.close();});
  server.createContext("/api/v2/internal/audit/appointment-events",x->{x.getRequestBody().readAllBytes();x.sendResponseHeaders(audits.incrementAndGet()==1?503:200,-1);x.close();});server.start();
  try{
   var relay=new com.clinic.v2.appointment.service.AppointmentEventRelay(jdbc,new WorkloadTokenIssuer("synthetic-appointment-relay-secret-at-least-32-bytes"),"http://127.0.0.1:"+server.getAddress().getPort(),"http://127.0.0.1:"+server.getAddress().getPort());
   var tx=new TransactionTemplate(manager);
   tx.execute(s->{jdbc.execute("select set_config('app.appointment_mode','relay',true)");jdbc.update("update appointment_v2.outbox_events set status='PUBLISHED' where aggregate_id<>?",a.id());return null;});
   for(int i=0;i<3;i++){
    tx.execute(s->{jdbc.execute("select set_config('app.appointment_mode','relay',true)");jdbc.update("update appointment_v2.outbox_events set next_attempt_at=now() where aggregate_id=?",a.id());relay.deliver();return null;});
   }
   assertEquals(2,notifications.get());assertEquals(2,audits.get());
   assertEquals("PUBLISHED",tenant(()->jdbc.queryForObject("select status from appointment_v2.outbox_events where aggregate_id=?",String.class,a.id())));
  }finally{server.stop(0);}
 }
 @Test void doctorAbsenceIsVisibleKeepsPriceAndBlocksArrivalUntilResolved()throws Exception{
  var a=confirm(hold(availability().getFirst().slotId(),"absence"));UUID staff=UUID.randomUUID();
  var input=new com.clinic.v2.appointment.service.ReceptionExceptionService.Input(staff,a.version(),"DOCTOR_ABSENT","Synthetic private reason");
  var exception=exceptions.record(clinicId,branchId,a.id(),"absence-key",input);assertEquals("OPEN",exception.state());assertEquals("IN_APP",exception.notificationMode());
  var current=arrivals.read(clinicId,branchId,a.id());assertEquals("CONFIRMED",current.status());assertEquals(exception.id(),exceptions.record(clinicId,branchId,a.id(),"absence-key",new com.clinic.v2.appointment.service.ReceptionExceptionService.Input(staff,current.version(),"DOCTOR_ABSENT",input.reason())).id());
  assertThrows(ApiProblem.class,()->arrivals.claim(clinicId,branchId,a.id(),new com.clinic.v2.appointment.service.ArrivalService.Input(patientId,UUID.randomUUID(),staff,current.version())));
  assertEquals(100000L,tenant(()->jdbc.queryForObject("select amount_vnd from appointment_v2.appointments where id=?",Long.class,a.id())));
  var payload=tenant(()->jdbc.queryForObject("select payload_json from appointment_v2.outbox_events where aggregate_id=? and event_type='clinic.appointment.exception_recorded.v1'",String.class,a.id()));
  assertFalse(payload.contains("private reason"));var data=json.readTree(payload).get("data");assertEquals(staff.toString(),data.get("actorUserId").asText());assertEquals(userId.toString(),data.get("recipientUserId").asText());
 }
 @Test void noShowRequiresPastStartAndPreservesFinancialSnapshot(){
  var a=confirm(hold(availability().getFirst().slotId(),"no-show"));var input=new com.clinic.v2.appointment.service.ReceptionExceptionService.Input(UUID.randomUUID(),a.version(),"NO_SHOW","Synthetic no show");
  assertThrows(ApiProblem.class,()->exceptions.record(clinicId,branchId,a.id(),"no-show-key",input));
  tenant(()->jdbc.update("update appointment_v2.capacity_slots set starts_at=now()-interval '1 minute',ends_at=now()+interval '29 minutes' where id=?",a.slotId()));
  assertEquals("NO_SHOW",exceptions.record(clinicId,branchId,a.id(),"no-show-key",input).type());assertEquals("NO_SHOW",arrivals.read(clinicId,branchId,a.id()).status());
  assertEquals(100000L,tenant(()->jdbc.queryForObject("select amount_vnd from appointment_v2.appointments where id=?",Long.class,a.id())));
 }
 @Test void arrivalClaimIsExactlyOnceAndStopsPatientCancellation(){
  var a=confirm(hold(availability().getFirst().slotId(),"arrival"));
  tenant(()->jdbc.update("update appointment_v2.capacity_slots set starts_at=now(),ends_at=now()+interval '30 minutes' where id=?",a.slotId()));
  UUID encounter=UUID.randomUUID();var input=new com.clinic.v2.appointment.service.ArrivalService.Input(patientId,encounter,userId,a.version());
  var claim=arrivals.claim(clinicId,branchId,a.id(),input);assertEquals("CHECKED_IN",claim.status());assertEquals(encounter,claim.encounterId());assertEquals(claim.version(),arrivals.claim(clinicId,branchId,a.id(),input).version());
  assertThrows(ApiProblem.class,()->arrivals.claim(clinicId,branchId,a.id(),new com.clinic.v2.appointment.service.ArrivalService.Input(patientId,UUID.randomUUID(),userId,claim.version())));
  assertThrows(ApiProblem.class,()->arrivals.read(clinicId,UUID.randomUUID(),a.id()));
  assertThrows(ApiProblem.class,()->service.cancel(actor,a.id(),new CancelInput(clinicId,patientId,"Synthetic cancel","arrival")));
  assertEquals(1,tenant(()->jdbc.queryForObject("select count(*) from appointment_v2.appointment_history where appointment_id=? and to_status='CHECKED_IN'",Integer.class,a.id())));
 }
 @Test void pendingHoldRecoveryShowsOnlyOwnedActiveUnexpiredHolds(){
  var h=hold(availability().getFirst().slotId(),"recover");
  var recovered=service.mineHolds(actor,clinicId,patientId);
  assertEquals(1,recovered.size());assertEquals(h.holdId(),recovered.getFirst().hold().holdId());
  assertEquals(doctorId,recovered.getFirst().doctorId());assertEquals(offeringId,recovered.getFirst().offeringId());
  assertEquals(0,service.mineHolds(actor,UUID.randomUUID(),patientId).size());
  assertThrows(ApiProblem.class,()->service.mineHolds(new Actor(UUID.randomUUID(),Set.of("ROLE_PATIENT")),clinicId,patientId));
  tenant(()->jdbc.update("update appointment_v2.slot_reservations set expires_at=now()-interval '1 second' where id=?",h.holdId()));
  assertTrue(service.mineHolds(actor,clinicId,patientId).isEmpty());
 }
 @Test void expiredHoldReleasesSlotAndCannotConfirm(){
  var h=hold(availability().get(0).slotId(),"expired");
  tenant(()->jdbc.update("update appointment_v2.slot_reservations set expires_at=now()-interval '1 second' where id=?",h.holdId()));
  assertThrows(ApiProblem.class,()->confirm(h));
  assertEquals("ACTIVE",hold(h.slotId(),"replacement").state());
 }
 @Test void suspendedClinicAndStaleScheduleDenyConfirmationWithoutLosingOriginalHold(){
  var h=hold(availability().get(0).slotId(),"stale");
  when(clinic.requireEligible(clinicId,branchId)).thenThrow(ApiProblem.unavailable("Synthetic suspended"));
  assertThrows(ApiProblem.class,()->confirm(h));
  doReturn(new ClinicSourceClient.BookingEligibility(clinicId,true,2)).when(clinic).requireEligible(clinicId,branchId);
  when(doctor.requireDoctor(clinicId,branchId,doctorId)).thenReturn(new DoctorSourceClient.Doctor(doctorId,clinicId,branchId,
    "Synthetic","GEN","Synthetic",null,1,List.of(new DoctorSourceClient.Schedule(date.getDayOfWeek().getValue(),
      LocalTime.of(8,0),LocalTime.of(17,0),"Asia/Ho_Chi_Minh",date.minusDays(1),date.plusDays(1),3))));
  assertThrows(ApiProblem.class,()->confirm(h));
  assertEquals(0,tenant(()->jdbc.queryForObject("select count(*) from appointment_v2.appointments",Integer.class)));
 }
 @Test void rescheduleConsumesNewHoldAndRetryReturnsSameAppointment(){
  var slots=availability();var a=confirm(hold(slots.get(0).slotId(),"old"));
  var next=hold(slots.get(1).slotId(),"new");
  var request=new RescheduleInput(clinicId,patientId,next.holdId(),"Synthetic move","test-move");
  var moved=service.reschedule(actor,a.id(),request);
  assertEquals(next.slotId(),moved.slotId());assertEquals(moved.id(),service.reschedule(actor,a.id(),request).id());
  assertTrue(availability().stream().anyMatch(s->s.slotId().equals(a.slotId())));
 }
 @Test void failedReschedulePreservesOriginalAndPatientCannotAccessOthers(){
  var slots=availability();var a=confirm(hold(slots.get(0).slotId(),"old"));var next=hold(slots.get(1).slotId(),"new");
  tenant(()->jdbc.update("update appointment_v2.slot_reservations set expires_at=now()-interval '1 second' where id=?",next.holdId()));
  assertThrows(ApiProblem.class,()->service.reschedule(actor,a.id(),new RescheduleInput(clinicId,patientId,next.holdId(),"Synthetic","move")));
  assertEquals(a.slotId(),service.mine(actor,clinicId,patientId).get(0).slotId());
  assertThrows(ApiProblem.class,()->service.mine(new Actor(UUID.randomUUID(),Set.of("ROLE_PATIENT")),clinicId,patientId));
 }
 @Test void differentOfferingCannotDoubleBookSameDoctor(){
  var slot=availability().get(0);hold(slot.slotId(),"first");
  UUID other=UUID.randomUUID();
  when(catalog.requireOffering(clinicId,branchId,other)).thenReturn(new CatalogSourceClient.Offering(other,clinicId,branchId,
    "OTHER","Synthetic",null,"GEN",30,100000,"VND",UUID.randomUUID(),Instant.now(),null,null,1,2));
  var available=service.availability(clinicId,branchId,other,doctorId,date);
  assertTrue(available.stream().noneMatch(s->s.startsAt().equals(slot.startsAt())));
 }
 @Test void sourceAbsenceBlocksStaleHoldConfirmAndHalfOpenAvailability(){
  var slots=availability();var first=slots.get(0);var h=hold(first.slotId(),"before-absence");
  var absent=new DoctorSourceClient.Doctor(doctorId,clinicId,branchId,sourceDoctor.displayName(),sourceDoctor.specialtyCode(),sourceDoctor.specialtyName(),null,sourceDoctor.affiliationVersion(),sourceDoctor.schedules(),List.of(new DoctorSourceClient.Absence(first.startsAt(),first.endsAt())));when(doctor.requireDoctor(clinicId,branchId,doctorId)).thenReturn(absent);
  assertThrows(ApiProblem.class,()->confirm(h));assertEquals("ACTIVE",tenant(()->jdbc.queryForObject("select state from appointment_v2.slot_reservations where id=?",String.class,h.holdId())));
  assertThrows(ApiProblem.class,()->hold(first.slotId(),"stale-new-key"));var visible=availability();assertTrue(visible.stream().noneMatch(s->s.startsAt().equals(first.startsAt())));assertTrue(visible.stream().anyMatch(s->s.startsAt().equals(first.endsAt())));assertEquals(0,tenant(()->jdbc.queryForObject("select count(*) from appointment_v2.appointments",Integer.class)));
 }
 @Test void bulkAbsenceDeduplicatesAcrossManagersAndKeepsBookingPrice(){
  var slot=availability().get(0);var a=confirm(hold(slot.slotId(),"impact"));UUID absence=UUID.randomUUID();UUID staff=UUID.randomUUID();
  assertEquals(1,arrivals.affected(clinicId,branchId,doctorId,absence,slot.startsAt(),slot.endsAt()).size());assertTrue(arrivals.affected(clinicId,branchId,doctorId,absence,slot.endsAt(),slot.endsAt().plusSeconds(1800)).isEmpty());
  assertThrows(ApiProblem.class,()->exceptions.record(clinicId,branchId,a.id(),"stale-window",new com.clinic.v2.appointment.service.ReceptionExceptionService.Input(staff,0,"DOCTOR_ABSENT","Synthetic stale impact",absence,doctorId,slot.endsAt(),slot.endsAt().plusSeconds(1800))));
  var one=exceptions.record(clinicId,branchId,a.id(),"first-manager",new com.clinic.v2.appointment.service.ReceptionExceptionService.Input(staff,0,"DOCTOR_ABSENT","Synthetic source absence",absence,doctorId,slot.startsAt(),slot.endsAt()));
  var replay=exceptions.record(clinicId,branchId,a.id(),"other-manager",new com.clinic.v2.appointment.service.ReceptionExceptionService.Input(UUID.randomUUID(),1,"DOCTOR_ABSENT","Synthetic source absence",absence,doctorId,slot.startsAt(),slot.endsAt()));assertEquals(one.id(),replay.id());assertTrue(arrivals.affected(clinicId,branchId,doctorId,absence,slot.startsAt(),slot.endsAt()).isEmpty());
  assertEquals(1,tenant(()->jdbc.queryForObject("select count(*) from appointment_v2.reception_exceptions where appointment_id=?",Integer.class,a.id())));assertEquals(2,tenant(()->jdbc.queryForObject("select count(*) from appointment_v2.outbox_events where aggregate_id=?",Integer.class,a.id())));var preserved=service.mine(actor,clinicId,patientId).getFirst();assertEquals("CONFIRMED",preserved.status());assertEquals(a.price(),preserved.price());
 }
}

