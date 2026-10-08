package com.clinic.encounter;

import com.clinic.encounter.api.EncounterDto.*;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class ReceptionTicketViewTest {
 @Test void patientEnrichmentPreservesDoctorAndArrivalTime(){
  UUID doctor=UUID.randomUUID();Instant arrived=Instant.parse("2026-10-04T03:10:00Z");
  var patient=new PatientSummary(UUID.randomUUID(),"PT-UNIT","Unit Patient",LocalDate.of(2000,1,1));
  var ticket=new TicketView(UUID.randomUUID(),UUID.randomUUID(),UUID.randomUUID(),LocalDate.of(2026,10,4),1,"R1-0001","WAITING",0)
   .withIssuedAt(arrived.plusSeconds(600)).withReception(doctor,arrived).withPatient(patient);
  assertEquals(doctor,ticket.doctorId());assertEquals(arrived,ticket.checkedInAt());assertEquals(patient,ticket.patient());
  assertEquals(arrived.plusSeconds(600),ticket.issuedAt());
 }
 @Test void olderTicketConstructorDoesNotInventReceptionMetadata(){
  var ticket=new TicketView(UUID.randomUUID(),UUID.randomUUID(),UUID.randomUUID(),LocalDate.of(2026,10,4),1,"R1-0001","WAITING",0);
  assertNull(ticket.doctorId());assertNull(ticket.checkedInAt());
 }
}
