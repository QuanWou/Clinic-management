package com.clinic.patient.api;
import com.clinic.patient.api.PatientDto.*;
import com.clinic.patient.security.WorkloadPrincipal;
import com.clinic.patient.service.PatientService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
@RestController
@RequestMapping("/api/internal/patients")
public class InternalPatientController{
 private final PatientService service;public InternalPatientController(PatientService service){this.service=service;}
 @GetMapping("/{patientId}/booking-identity")
 public BookingIdentity booking(@AuthenticationPrincipal WorkloadPrincipal p,@PathVariable UUID patientId){return service.booking(patientId);}
 @PostMapping("/{patientId}/clinic-links/{clinicId}")
 public ClinicLinkView link(@AuthenticationPrincipal WorkloadPrincipal p,@PathVariable UUID patientId,@PathVariable UUID clinicId){return service.ensureClinicLink(clinicId,patientId);}
}
