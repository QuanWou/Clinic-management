package com.clinic.v2.doctor.api;
import com.clinic.v2.doctor.security.EncounterPeerVerifier;
import com.clinic.v2.doctor.service.DoctorService;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
@RestController
@RequestMapping("/api/v2/internal/clinics/{clinicId}/branches/{branchId}/doctors")
public class InternalDoctorController {
 private final DoctorService service;private final EncounterPeerVerifier peer;private final com.clinic.v2.doctor.service.AbsenceService absences;
 public InternalDoctorController(DoctorService service,EncounterPeerVerifier peer,com.clinic.v2.doctor.service.AbsenceService absences){this.service=service;this.peer=peer;this.absences=absences;}
 @GetMapping("/{id}/assignment") public DoctorService.Assignment assignment(@RequestHeader(value="Authorization",required=false) String bearer,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id){peer.require(bearer,"doctor.assignment.read");absences.requirePresent(clinicId,branchId,id,java.time.Instant.now());return service.assignment(clinicId,branchId,id);}
 @GetMapping("/absences/{id}") public com.clinic.v2.doctor.service.AbsenceService.View absence(@RequestHeader(value="Authorization",required=false) String bearer,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id){peer.require(bearer,"doctor.assignment.read");return absences.source(clinicId,branchId,id);}
}
