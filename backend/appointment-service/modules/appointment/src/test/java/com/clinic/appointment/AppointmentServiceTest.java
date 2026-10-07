package com.clinic.appointment;

import com.clinic.appointment.api.ApiProblem;
import com.clinic.appointment.api.AppointmentDto.*;
import com.clinic.appointment.domain.*;
import com.clinic.appointment.repo.*;
import com.clinic.appointment.security.*;
import com.clinic.appointment.service.AppointmentService;
import com.clinic.appointment.source.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.mockito.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AppointmentServiceTest {
  CapacitySlotRepository slots=mock(CapacitySlotRepository.class);
  SlotReservationRepository holds=mock(SlotReservationRepository.class);
  AppointmentRepository appointments=mock(AppointmentRepository.class);
  AppointmentHistoryRepository histories=mock(AppointmentHistoryRepository.class);
  OutboxEventRepository outbox=mock(OutboxEventRepository.class);
  TenantDbContext db=mock(TenantDbContext.class);
  ClinicSourceClient clinic=mock(ClinicSourceClient.class);
  PatientSourceClient patient=mock(PatientSourceClient.class);
  DoctorSourceClient doctor=mock(DoctorSourceClient.class);
  CatalogSourceClient catalog=mock(CatalogSourceClient.class);
  AppointmentService service=new AppointmentService(slots,holds,appointments,histories,outbox,new ObjectMapper(),db,clinic,patient,doctor,catalog,600);

  UUID clinicId=UUID.randomUUID(),branchId=UUID.randomUUID(),offeringId=UUID.randomUUID(),doctorId=UUID.randomUUID(),patientId=UUID.randomUUID(),userId=UUID.randomUUID();
  Actor actor=new Actor(userId,Set.of("ROLE_PATIENT"));

  CapacitySlot slot(){
    CapacitySlot s=new CapacitySlot();s.id=UUID.randomUUID();s.clinicId=clinicId;s.branchId=branchId;s.offeringId=offeringId;s.doctorId=doctorId;
    s.startsAt=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(2).atTime(9,0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant();
    s.endsAt=s.startsAt.plusSeconds(1800);s.capacity=1;s.scheduleVersion=2;s.offeringVersion=4;s.active=true;return s;
  }
  DoctorSourceClient.Doctor sourceDoctor(CapacitySlot s){
    var z=s.startsAt.atZone(ZoneId.of("Asia/Ho_Chi_Minh"));
    var schedule=new DoctorSourceClient.Schedule(z.getDayOfWeek().getValue(),LocalTime.MIN,LocalTime.MAX,"Asia/Ho_Chi_Minh",
      z.toLocalDate().minusDays(1),z.toLocalDate().plusDays(1),2);
    return new DoctorSourceClient.Doctor(doctorId,clinicId,branchId,"BS Synthetic","GEN","Nội","Bác sĩ",1,List.of(schedule));
  }
  CatalogSourceClient.Offering sourceOffering(){
    return new CatalogSourceClient.Offering(offeringId,clinicId,branchId,"CONSULT","Khám","", "GEN",30,100000,"VND",UUID.randomUUID(),
      Instant.now().minusSeconds(3600),null,null,3,4);
  }

  DoctorSourceClient.Doctor sourceDoctor(LocalDate date,LocalTime start,LocalTime end,String specialty){
    var schedule=new DoctorSourceClient.Schedule(date.getDayOfWeek().getValue(),start,end,"Asia/Ho_Chi_Minh",date.minusDays(30),null,2);
    return new DoctorSourceClient.Doctor(doctorId,clinicId,branchId,"BS Synthetic",specialty,"Nội tổng quát","Bác sĩ",1,List.of(schedule));
  }

  @Test void bookingOptionsOnlyExposeDoctorsWithWorkingScheduleAndCompatiblePublicService(){
    LocalDate date=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(2);
    var eligible=sourceDoctor(date,LocalTime.of(8,0),LocalTime.of(12,0),"GEN");
    var noSchedule=new DoctorSourceClient.Doctor(UUID.randomUUID(),clinicId,branchId,"No Schedule","GEN","Nội tổng quát","Bác sĩ",1,List.of());
    var gen=sourceOffering();
    var other=new CatalogSourceClient.Offering(UUID.randomUUID(),clinicId,branchId,"PED","Khám nhi","","PED",30,100000,"VND",UUID.randomUUID(),Instant.now().minusSeconds(60),null,null,1,1);
    when(doctor.listDoctors(clinicId,branchId)).thenReturn(List.of(eligible,noSchedule));
    when(catalog.listOfferings(clinicId,branchId)).thenReturn(List.of(gen,other));

    BookingOptions result=service.bookingOptions(clinicId,branchId);

    assertEquals(1,result.doctors().size());
    assertEquals(doctorId,result.doctors().getFirst().doctorId());
    assertEquals(1,result.offerings().size());
    assertEquals(offeringId,result.offerings().getFirst().offeringId());
    assertEquals("GEN",result.specialties().getFirst().code());
  }

  @Test void availabilityExplainsDoctorNotWorkingInsteadOfGenericEmptyList(){
    LocalDate requested=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(3);
    LocalDate differentDay=requested.plusDays(1);
    when(doctor.findDoctor(clinicId,branchId,doctorId)).thenReturn(Optional.of(sourceDoctor(differentDay,LocalTime.of(8,0),LocalTime.of(12,0),"GEN")));
    when(catalog.findOffering(clinicId,branchId,offeringId)).thenReturn(Optional.of(sourceOffering()));
    when(slots.findByClinicIdAndBranchIdAndOfferingIdAndDoctorIdAndStartsAtBetweenOrderByStartsAtAsc(any(),any(),any(),any(),any(),any())).thenReturn(List.of());

    AvailabilityResult result=service.availabilityResult(clinicId,branchId,offeringId,doctorId,requested);

    assertFalse(result.available());
    assertEquals(AvailabilityReason.DOCTOR_NOT_WORKING,result.reason());
    assertTrue(result.slots().isEmpty());
  }

  @Test void availabilityRejectsServiceFromAnotherSpecialty(){
    LocalDate requested=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(2);
    when(doctor.findDoctor(clinicId,branchId,doctorId)).thenReturn(Optional.of(sourceDoctor(requested,LocalTime.of(8,0),LocalTime.of(12,0),"GEN")));
    var incompatible=new CatalogSourceClient.Offering(offeringId,clinicId,branchId,"PED","Khám nhi","","PED",30,100000,"VND",UUID.randomUUID(),Instant.now(),null,null,1,1);
    when(catalog.findOffering(clinicId,branchId,offeringId)).thenReturn(Optional.of(incompatible));

    AvailabilityResult result=service.availabilityResult(clinicId,branchId,offeringId,doctorId,requested);

    assertEquals(AvailabilityReason.SERVICE_NOT_SUPPORTED,result.reason());
    verifyNoInteractions(slots);
  }

  @Test void availabilityDistinguishesFullyBookedFromAvailable(){
    LocalDate requested=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(2);
    var d=sourceDoctor(requested,LocalTime.of(9,0),LocalTime.of(9,30),"GEN");
    var o=sourceOffering();
    var s=new CapacitySlot();s.id=UUID.randomUUID();s.clinicId=clinicId;s.branchId=branchId;s.offeringId=offeringId;s.doctorId=doctorId;
    s.startsAt=requested.atTime(9,0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant();s.endsAt=s.startsAt.plusSeconds(1800);s.capacity=1;s.scheduleVersion=2;s.offeringVersion=o.branchOfferingVersion();s.active=true;
    when(doctor.findDoctor(clinicId,branchId,doctorId)).thenReturn(Optional.of(d));
    when(catalog.findOffering(clinicId,branchId,offeringId)).thenReturn(Optional.of(o));
    when(slots.findByClinicIdAndBranchIdAndOfferingIdAndDoctorIdAndStartsAtBetweenOrderByStartsAtAsc(any(),any(),any(),any(),any(),any())).thenReturn(List.of(s));
    when(slots.findByClinicIdAndBranchIdAndOfferingIdAndDoctorIdAndStartsAt(clinicId,branchId,offeringId,doctorId,s.startsAt)).thenReturn(Optional.of(s));
    when(slots.countOverlapping(eq(doctorId),eq(s.startsAt),eq(s.endsAt),any(),isNull(),isNull())).thenReturn(1L);

    AvailabilityResult result=service.availabilityResult(clinicId,branchId,offeringId,doctorId,requested);

    assertFalse(result.available());
    assertEquals(AvailabilityReason.FULLY_BOOKED,result.reason());
  }

  void commonPatient(){
    when(patient.booking(patientId)).thenReturn(new PatientSourceClient.BookingIdentity(patientId,userId,true));
  }

  @Test void capacityOneRejectsSecondActiveHold(){
    commonPatient();CapacitySlot s=slot();
    when(doctor.requireDoctor(clinicId,branchId,doctorId)).thenReturn(sourceDoctor(s));
    when(catalog.requireOffering(clinicId,branchId,offeringId)).thenReturn(sourceOffering());
    when(holds.findByPatientIdAndIdempotencyKey(patientId,"k1")).thenReturn(Optional.empty());
    when(slots.lockById(s.id)).thenReturn(Optional.of(s));
    when(slots.countOverlapping(eq(s.doctorId),eq(s.startsAt),eq(s.endsAt),any(),isNull(),isNull())).thenReturn(1L);
    when(appointments.countOccupying(s.id)).thenReturn(0L);

    ApiProblem ex=assertThrows(ApiProblem.class,()->service.hold(actor,"k1",new HoldInput(clinicId,branchId,offeringId,doctorId,s.id,patientId)));
    assertEquals("SLOT_UNAVAILABLE",ex.code);
    verify(holds,never()).saveAndFlush(any());
  }

  @Test void sameHoldIdempotencyReturnsOriginalWithoutAllocatingAgain() throws Exception{
    commonPatient();CapacitySlot s=slot();var offering=sourceOffering();
    when(doctor.requireDoctor(clinicId,branchId,doctorId)).thenReturn(sourceDoctor(s));
    when(catalog.requireOffering(clinicId,branchId,offeringId)).thenReturn(offering);
    SlotReservation h=new SlotReservation();h.id=UUID.randomUUID();h.slotId=s.id;h.clinicId=clinicId;h.branchId=branchId;h.patientId=patientId;
    h.priceVersionId=offering.priceVersionId();h.amountVnd=offering.amountVnd();h.currency="VND";h.priceEffectiveFrom=offering.effectiveFrom();
    h.state="ACTIVE";h.expiresAt=Instant.now().plusSeconds(300);h.idempotencyKey="same";
    String raw=clinicId+"|"+branchId+"|"+offeringId+"|"+doctorId+"|"+s.id+"|"+patientId;
    h.payloadHash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
    when(holds.findByPatientIdAndIdempotencyKey(patientId,"same")).thenReturn(Optional.of(h));

    HoldView view=service.hold(actor,"same",new HoldInput(clinicId,branchId,offeringId,doctorId,s.id,patientId));
    assertEquals(h.id,view.holdId());
    verify(slots,never()).lockById(any());
    verify(holds,never()).saveAndFlush(any());
  }

  @Test void expiredHoldCannotConfirm(){
    commonPatient();
    SlotReservation h=new SlotReservation();h.id=UUID.randomUUID();h.clinicId=clinicId;h.branchId=branchId;h.patientId=patientId;
    h.slotId=UUID.randomUUID();h.state="ACTIVE";h.expiresAt=Instant.now().minusSeconds(1);
    when(slots.findById(h.slotId)).thenReturn(Optional.of(slot()));
    when(holds.lockById(h.id)).thenReturn(Optional.of(h));
    when(appointments.findByPatientIdAndConfirmationKey(patientId,"confirm-1")).thenReturn(Optional.empty());
    when(appointments.findByReservationId(h.id)).thenReturn(Optional.empty());

    ApiProblem ex=assertThrows(ApiProblem.class,()->service.confirm(actor,"confirm-1",new ConfirmInput(clinicId,h.id,patientId)));
    assertEquals("SLOT_UNAVAILABLE",ex.code);
    assertEquals("EXPIRED",h.state);
    verify(appointments,never()).saveAndFlush(any());
  }
  @Test void rescheduleHoldCannotCreateAnotherAppointment(){
    commonPatient();var h=new SlotReservation();h.id=UUID.randomUUID();h.clinicId=clinicId;h.patientId=patientId;h.rescheduleAppointmentId=UUID.randomUUID();
    when(holds.lockById(h.id)).thenReturn(Optional.of(h));
    assertThrows(ApiProblem.class,()->service.confirm(actor,"wrong-confirm",new ConfirmInput(clinicId,h.id,patientId)));
    verifyNoInteractions(slots);verify(appointments,never()).saveAndFlush(any());
  }
  @Test void unboundHoldCannotMoveAnAppointment(){
    commonPatient();var a=new Appointment();a.id=UUID.randomUUID();a.clinicId=clinicId;a.patientId=patientId;a.status="CONFIRMED";
    var h=new SlotReservation();h.id=UUID.randomUUID();h.clinicId=clinicId;h.patientId=patientId;
    when(appointments.lockById(a.id)).thenReturn(Optional.of(a));when(holds.lockById(h.id)).thenReturn(Optional.of(h));
    assertThrows(ApiProblem.class,()->service.reschedule(actor,a.id,new RescheduleInput(clinicId,patientId,h.id,"Move","test")));
    verifyNoInteractions(slots);verify(appointments,never()).saveAndFlush(any());
  }
}
