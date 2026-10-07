package com.clinic.appointment.api;
import com.clinic.appointment.api.AppointmentDto.*;
import com.clinic.appointment.security.Actor;
import com.clinic.appointment.service.AppointmentService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
@RestController
@RequestMapping("/api/clinics/{clinicId}/branches/{branchId}/reception/appointments/{id}")
public class ReceptionAppointmentController {
 private final AppointmentService service;
 public ReceptionAppointmentController(AppointmentService service){this.service=service;}
 public record HoldChange(@NotNull UUID patientId,@NotNull UUID offeringId,@NotNull UUID doctorId,@NotNull UUID slotId,@Min(0) long expectedVersion){}
 public record Change(@NotNull UUID patientId,@NotNull UUID newHoldId,@Min(0) long expectedVersion,@NotBlank @Size(max=500) String reason){}
 @GetMapping public AppointmentView read(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id){return service.receptionRead(actor,clinicId,branchId,id);}
 @PostMapping("/holds") public HoldView hold(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody HoldChange in){return service.receptionHold(actor,id,key,new HoldInput(clinicId,branchId,in.offeringId(),in.doctorId(),in.slotId(),in.patientId()),in.expectedVersion());}
 @PostMapping("/change") public AppointmentView change(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id,@Valid @RequestBody Change in){return service.receptionReschedule(actor,clinicId,branchId,id,new RescheduleInput(clinicId,in.patientId(),in.newHoldId(),in.reason(),null),in.expectedVersion());}
}
