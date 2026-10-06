package com.clinic.appointment.api;
import com.clinic.appointment.security.EncounterPeerVerifier;
import com.clinic.appointment.service.ArrivalService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
@RestController
@RequestMapping("/api/internal/clinics/{clinicId}/branches/{branchId}/appointments/{id}")
public class InternalArrivalController {
 private final ArrivalService service;private final EncounterPeerVerifier peer;public InternalArrivalController(ArrivalService service,EncounterPeerVerifier peer){this.service=service;this.peer=peer;}
 @GetMapping public ArrivalService.Booking read(@RequestHeader(value="Authorization",required=false) String bearer,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id){peer.require(bearer,"appointment.arrival");return service.read(clinicId,branchId,id);}
 @PostMapping("/arrival") public ArrivalService.Booking claim(@RequestHeader(value="Authorization",required=false) String bearer,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id,@Valid @RequestBody ArrivalService.Input in){peer.require(bearer,"appointment.arrival");return service.claim(clinicId,branchId,id,in);}
}
