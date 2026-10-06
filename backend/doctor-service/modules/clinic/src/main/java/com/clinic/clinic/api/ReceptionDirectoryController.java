package com.clinic.clinic.api;
import com.clinic.clinic.security.Actor;
import com.clinic.clinic.service.ClinicOnboardingService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
@RestController
public class ReceptionDirectoryController {
 private final ClinicOnboardingService service;public ReceptionDirectoryController(ClinicOnboardingService service){this.service=service;}
 @GetMapping("/api/clinics/{clinicId}/reception-directory") public ClinicOnboardingService.ReceptionDirectory directory(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId){return service.receptionDirectory(actor,clinicId);}
 @GetMapping("/api/clinics/{clinicId}/care-directory") public ClinicOnboardingService.ReceptionDirectory careDirectory(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId){return service.careDirectory(actor,clinicId);}
 @GetMapping("/api/clinics/{clinicId}/lab-directory") public ClinicOnboardingService.ReceptionDirectory labDirectory(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId){return service.labDirectory(actor,clinicId);}
 @GetMapping("/api/clinics/{clinicId}/billing-directory") public ClinicOnboardingService.ReceptionDirectory billingDirectory(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId){return service.billingDirectory(actor,clinicId);}
}
