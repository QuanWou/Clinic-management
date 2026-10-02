package com.clinic.v2.appointment.api;
import com.clinic.v2.appointment.service.*;
import com.clinic.v2.appointment.security.EncounterPeerVerifier;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
@RestController
public class InternalFulfillmentController {
 private final FulfillmentService service;private final EncounterPeerVerifier peer;
 public InternalFulfillmentController(FulfillmentService service,EncounterPeerVerifier peer){this.service=service;this.peer=peer;}
 @PostMapping("/api/v2/internal/clinics/{clinic}/branches/{branch}/appointments/{id}/fulfillment")
 public ArrivalService.Booking accept(@RequestHeader(value="Authorization",required=false) String bearer,@PathVariable UUID clinic,@PathVariable UUID branch,@PathVariable UUID id,@Valid @RequestBody FulfillmentService.Input in){peer.require(bearer,"appointment.fulfill");return service.accept(clinic,branch,id,in);}
}
