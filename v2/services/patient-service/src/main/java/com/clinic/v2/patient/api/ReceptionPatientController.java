package com.clinic.v2.patient.api;
import com.clinic.v2.patient.security.Actor;
import com.clinic.v2.patient.service.ReceptionPatientService;
import com.clinic.v2.patient.service.ReceptionPatientService.*;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.time.LocalDate;
@RestController
@ConditionalOnProperty(name="patient.reception.enabled",havingValue="true")
@RequestMapping("/api/v2/clinics/{clinicId}/branches/{branchId}/patients")
public class ReceptionPatientController {
 private final ReceptionPatientService service;public ReceptionPatientController(ReceptionPatientService service){this.service=service;}
 @PostMapping("/walk-in") public PatientView provisional(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody ProvisionalInput in){return service.provisional(actor,clinicId,branchId,key,in);}
 @GetMapping("/match-suggestions") public List<PatientView> suggestions(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,@RequestParam(required=false) String name,@RequestParam(required=false) LocalDate dateOfBirth,@RequestParam(required=false) String phone){return service.suggestions(actor,clinicId,branchId,name,dateOfBirth,phone);}
 @PostMapping("/{patientId}/review") public PatientView review(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID patientId,@Valid @RequestBody ReviewInput in){return service.review(actor,clinicId,branchId,patientId,in);}
}
