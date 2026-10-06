package com.clinic.patient.api;
import com.clinic.patient.api.PatientDto.ClinicLinkView;
import com.clinic.patient.service.PatientService;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
@RestController
public class InternalClinicPatientController {
 private final PatientService service;public InternalClinicPatientController(PatientService service){this.service=service;}
 @GetMapping("/api/internal/clinics/{clinicId}/patients/{patientId}") public ClinicLinkView link(@PathVariable UUID clinicId,@PathVariable UUID patientId){return service.existingClinicLink(clinicId,patientId);}
 @PostMapping("/api/internal/clinics/{clinicId}/patient-identities") public java.util.List<PatientService.Identity> identities(@PathVariable UUID clinicId,@RequestBody java.util.List<UUID> ids){return service.identities(clinicId,ids);}
}
