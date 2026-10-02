package com.clinic.v2.billing.api;
import com.clinic.v2.billing.security.Actor;
import com.clinic.v2.billing.service.SourceChargeOperations;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
@RestController @RequestMapping("/api/v2/clinics/{clinicId}/branches/{branchId}/encounters/{encounterId}/source-charges")
public class SourceChargeOperationsController{
 private final SourceChargeOperations operations;public SourceChargeOperationsController(SourceChargeOperations operations){this.operations=operations;}
 public record Retry(@NotBlank @Size(max=500) String reason){}
 @GetMapping public SourceChargeOperations.State read(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID encounterId){return operations.read(actor,clinicId,branchId,encounterId);}
 @PostMapping("/{eventId}/retry") public SourceChargeOperations.State retry(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID encounterId,@PathVariable UUID eventId,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody Retry in){return operations.retry(actor,clinicId,branchId,encounterId,eventId,key,in.reason());}
}

