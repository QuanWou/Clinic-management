package com.clinic.doctor.api;
import com.clinic.doctor.security.EncounterPeerVerifier;
import com.clinic.doctor.service.DoctorService;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
@RestController
@RequestMapping("/api/internal/clinics/{clinicId}/branches/{branchId}/doctors")
public class InternalDoctorController {
 private final DoctorService service;private final EncounterPeerVerifier peer;private final com.clinic.doctor.service.AbsenceService absences;
 public InternalDoctorController(DoctorService service,EncounterPeerVerifier peer,com.clinic.doctor.service.AbsenceService absences){this.service=service;this.peer=peer;this.absences=absences;}
 @GetMapping("/{id}/assignment") public DoctorService.Assignment assignment(@RequestHeader(value="Authorization",required=false) String bearer,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id){peer.require(bearer,"doctor.assignment.read");absences.requirePresent(clinicId,branchId,id,java.time.Instant.now());return service.assignment(clinicId,branchId,id);}
 @GetMapping("/reception-candidates") public java.util.List<DoctorService.Assignment> candidates(@RequestHeader(value="Authorization",required=false) String bearer,@PathVariable UUID clinicId,@PathVariable UUID branchId,@RequestParam String specialtyCode){
  peer.require(bearer,"doctor.assignment.read");
  return service.receptionCandidates(clinicId,branchId,specialtyCode).stream().filter(d->{try{absences.requirePresent(clinicId,branchId,d.doctorId(),java.time.Instant.now());return true;}catch(com.clinic.doctor.api.ApiProblem e){return false;}}).toList();
 }
 @GetMapping("/absences/{id}") public com.clinic.doctor.service.AbsenceService.View absence(@RequestHeader(value="Authorization",required=false) String bearer,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id){peer.require(bearer,"doctor.assignment.read");return absences.source(clinicId,branchId,id);}
}
