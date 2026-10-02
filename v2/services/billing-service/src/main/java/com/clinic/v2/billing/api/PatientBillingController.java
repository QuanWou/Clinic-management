package com.clinic.v2.billing.api;
import com.clinic.v2.billing.security.Actor;
import com.clinic.v2.billing.service.PatientBillingService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController @RequestMapping("/api/v2/me/clinics/{clinicId}/branches/{branchId}/bills")
public class PatientBillingController {
 private final PatientBillingService service;public PatientBillingController(PatientBillingService service){this.service=service;}
 @GetMapping public List<PatientBillingService.Bill> list(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId){return service.list(actor,clinicId,branchId);}
 @GetMapping("/{id}") public PatientBillingService.Bill read(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id){return service.read(actor,clinicId,branchId,id);}
}
