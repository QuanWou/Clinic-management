package com.clinic.v2.encounter.api;
import com.clinic.v2.encounter.security.Actor;
import com.clinic.v2.encounter.service.ChargeDeliveryOperations;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
@RestController @RequestMapping("/api/v2/clinics/{clinicId}/branches/{branchId}/encounters/{encounterId}/billing-deliveries")
public class ChargeDeliveryOperationsController{
 private final ChargeDeliveryOperations operations;public ChargeDeliveryOperationsController(ChargeDeliveryOperations operations){this.operations=operations;}
 public record Retry(@NotBlank @Size(max=500) String reason){}
 @GetMapping public ChargeDeliveryOperations.State read(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID encounterId){return operations.read(actor,clinicId,branchId,encounterId);}
 @PostMapping("/{eventId}/retry") public ChargeDeliveryOperations.State retry(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID encounterId,@PathVariable UUID eventId,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody Retry in){return operations.retry(actor,clinicId,branchId,encounterId,eventId,key,in.reason());}
}

