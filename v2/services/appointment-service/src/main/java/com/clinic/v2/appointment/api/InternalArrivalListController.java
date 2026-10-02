package com.clinic.v2.appointment.api;
import com.clinic.v2.appointment.security.EncounterPeerVerifier;
import com.clinic.v2.appointment.service.ArrivalService;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.time.LocalDate;
@RestController
public class InternalArrivalListController {
 private final ArrivalService service;private final EncounterPeerVerifier peer;public InternalArrivalListController(ArrivalService service,EncounterPeerVerifier peer){this.service=service;this.peer=peer;}
 @GetMapping("/api/v2/internal/clinics/{clinicId}/branches/{branchId}/appointments") public List<ArrivalService.ArrivalItem> list(@RequestHeader(value="Authorization",required=false) String bearer,@PathVariable UUID clinicId,@PathVariable UUID branchId,@RequestParam LocalDate date){peer.require(bearer,"appointment.arrival");return service.list(clinicId,branchId,date);}
}
