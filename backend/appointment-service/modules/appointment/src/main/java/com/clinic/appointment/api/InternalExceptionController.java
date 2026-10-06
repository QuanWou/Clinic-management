package com.clinic.appointment.api;
import com.clinic.appointment.security.EncounterPeerVerifier;
import com.clinic.appointment.service.ReceptionExceptionService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController
@RequestMapping("/api/internal/clinics/{clinicId}/branches/{branchId}/appointments/{id}/exceptions")
public class InternalExceptionController {
 private final ReceptionExceptionService service;private final EncounterPeerVerifier peer;
 public InternalExceptionController(ReceptionExceptionService service,EncounterPeerVerifier peer){this.service=service;this.peer=peer;}
 @GetMapping public List<ReceptionExceptionService.View> list(@RequestHeader(value="Authorization",required=false) String bearer,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id){peer.require(bearer,"appointment.arrival");return service.list(clinicId,branchId,id);}
 @PostMapping public ReceptionExceptionService.View record(@RequestHeader(value="Authorization",required=false) String bearer,@RequestHeader("Idempotency-Key") String key,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id,@Valid @RequestBody ReceptionExceptionService.Input in){peer.require(bearer,"appointment.arrival");return service.record(clinicId,branchId,id,key,in);}
 @PostMapping("/{exceptionId}/resolve") public ReceptionExceptionService.View resolve(@RequestHeader(value="Authorization",required=false) String bearer,@RequestHeader("Idempotency-Key") String key,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id,@PathVariable UUID exceptionId,@Valid @RequestBody ReceptionExceptionService.ResolveInput in){peer.require(bearer,"appointment.arrival");return service.resolve(clinicId,branchId,id,exceptionId,key,in);}
}
