package com.clinic.v2.patient.api;
import com.clinic.v2.patient.api.PatientDto.ClinicLinkView;
import com.clinic.v2.patient.service.PatientService;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
@RestController
public class InternalClinicPatientController {
 private final PatientService service;public InternalClinicPatientController(PatientService service){this.service=service;}
 @GetMapping("/api/v2/internal/clinics/{clinicId}/patients/{patientId}") public ClinicLinkView link(@PathVariable UUID clinicId,@PathVariable UUID patientId){return service.existingClinicLink(clinicId,patientId);}
}
