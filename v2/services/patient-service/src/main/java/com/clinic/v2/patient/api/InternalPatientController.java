package com.clinic.v2.patient.api;
import com.clinic.v2.patient.api.PatientDto.*;
import com.clinic.v2.patient.security.WorkloadPrincipal;
import com.clinic.v2.patient.service.PatientService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
@RestController
@RequestMapping("/api/v2/internal/patients")
public class InternalPatientController{
 private final PatientService service;public InternalPatientController(PatientService service){this.service=service;}
 @GetMapping("/{patientId}/booking-identity")
 public BookingIdentity booking(@AuthenticationPrincipal WorkloadPrincipal p,@PathVariable UUID patientId){return service.booking(patientId);}
 @PostMapping("/{patientId}/clinic-links/{clinicId}")
 public ClinicLinkView link(@AuthenticationPrincipal WorkloadPrincipal p,@PathVariable UUID patientId,@PathVariable UUID clinicId){return service.ensureClinicLink(clinicId,patientId);}
}
