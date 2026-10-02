package com.clinic.v2.appointment.api;
import com.clinic.v2.appointment.security.EncounterPeerVerifier;
import com.clinic.v2.appointment.service.ArrivalService;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.time.*;
@RestController
@RequestMapping("/api/v2/internal/clinics/{clinicId}/branches/{branchId}/absence-impact")
public class InternalAbsenceImpactController {
 private final ArrivalService service;private final EncounterPeerVerifier peer;public InternalAbsenceImpactController(ArrivalService service,EncounterPeerVerifier peer){this.service=service;this.peer=peer;}
 @GetMapping public List<ArrivalService.ArrivalItem> list(@RequestHeader(value="Authorization",required=false) String token,@PathVariable UUID clinicId,@PathVariable UUID branchId,@RequestParam UUID doctorId,@RequestParam UUID absenceId,@RequestParam Instant startsAt,@RequestParam Instant endsAt){peer.require(token,"appointment.arrival");return service.affected(clinicId,branchId,doctorId,absenceId,startsAt,endsAt);}
}
