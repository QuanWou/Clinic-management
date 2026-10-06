package com.clinic.doctor.api;
import com.clinic.doctor.security.*;
import com.clinic.doctor.service.AbsenceService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController
@RequestMapping("/api/clinics/{clinicId}/branches/{branchId}/doctors/{doctorId}/absences")
public class AbsenceController {
 private final AbsenceService service;public AbsenceController(AbsenceService service){this.service=service;}
 @GetMapping public List<AbsenceService.View> list(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID doctorId){return service.list(actor,clinicId,branchId,doctorId);}
 @PostMapping public AbsenceService.View report(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID doctorId,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody AbsenceService.Input in){return service.report(actor,clinicId,branchId,doctorId,key,in);}
 @PostMapping("/{id}/cancel") public AbsenceService.Change cancel(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID doctorId,@PathVariable UUID id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody AbsenceService.CancelInput in){return service.cancel(actor,clinicId,branchId,doctorId,id,key,in);}
 @PostMapping("/{id}/amend") public AbsenceService.Change amend(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID doctorId,@PathVariable UUID id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody AbsenceService.AmendInput in){return service.amend(actor,clinicId,branchId,doctorId,id,key,in);}
}
