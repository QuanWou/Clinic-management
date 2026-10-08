package com.clinic.patient.api;
import com.clinic.patient.security.Actor;
import com.clinic.patient.service.ClinicPatientProfileService;
import com.clinic.patient.service.ClinicPatientProfileService.*;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/clinics/{clinicId}/patient-profiles")
@ConditionalOnProperty(name="patient.reception.enabled",havingValue="true")
public class ClinicPatientProfileController {
 private final ClinicPatientProfileService service;
 public ClinicPatientProfileController(ClinicPatientProfileService service){this.service=service;}
 @GetMapping public Page list(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,
  @RequestParam(defaultValue="") String query,@RequestParam(defaultValue="") String status,@RequestParam(defaultValue="") String account,
  @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.list(actor,clinicId,query,status,account,page,size);}
 @GetMapping("/{patientId}") public Detail get(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID patientId){return service.detail(actor,clinicId,patientId);}
 @PostMapping @ResponseStatus(HttpStatus.CREATED) public Profile create(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,
  @RequestHeader("Idempotency-Key") String key,@Valid @RequestBody Input in){return service.create(actor,clinicId,key,in);}
 @PutMapping("/{patientId}") public Profile update(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID patientId,@Valid @RequestBody Input in){return service.update(actor,clinicId,patientId,in);}
}
