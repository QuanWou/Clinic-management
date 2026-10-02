package com.clinic.v2.patient.api;
import com.clinic.v2.patient.api.PatientDto.OwnClinicLink;
import com.clinic.v2.patient.security.Actor;
import com.clinic.v2.patient.service.PatientService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController @RequestMapping("/api/v2/me/patient-clinic-links")
public class OwnClinicLinkController {
 private final PatientService service;public OwnClinicLinkController(PatientService service){this.service=service;}
 @GetMapping public List<OwnClinicLink> list(@AuthenticationPrincipal Actor actor){return service.ownClinicLinks(actor);}
 @GetMapping("/{clinicId}") public OwnClinicLink read(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId){return service.ownClinicLink(actor,clinicId);}
}
