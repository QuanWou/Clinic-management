package com.clinic.v2.appointment;

import com.clinic.v2.appointment.api.ApiProblem;
import com.clinic.v2.appointment.api.AppointmentDto.*;
import com.clinic.v2.appointment.domain.*;
import com.clinic.v2.appointment.repo.*;
import com.clinic.v2.appointment.security.*;
import com.clinic.v2.appointment.service.AppointmentService;
import com.clinic.v2.appointment.source.*;
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
}
