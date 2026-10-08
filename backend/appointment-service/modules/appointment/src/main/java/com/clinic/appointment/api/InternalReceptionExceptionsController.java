package com.clinic.appointment.api;
import com.clinic.appointment.security.EncounterPeerVerifier;
import com.clinic.appointment.service.ReceptionExceptionService;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController
public class InternalReceptionExceptionsController {
 private final EncounterPeerVerifier peer;private final ReceptionExceptionService service;
 public InternalReceptionExceptionsController(EncounterPeerVerifier peer,ReceptionExceptionService service){this.peer=peer;this.service=service;}
 @GetMapping("/api/internal/clinics/{clinicId}/branches/{branchId}/reception/exceptions") public List<ReceptionExceptionService.View> list(@RequestHeader(value="Authorization",required=false) String bearer,@PathVariable UUID clinicId,@PathVariable UUID branchId){peer.require(bearer,"appointment.arrival");return service.open(clinicId,branchId);}
}
