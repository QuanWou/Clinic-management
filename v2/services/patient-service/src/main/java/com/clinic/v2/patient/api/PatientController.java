package com.clinic.v2.patient.api;
import com.clinic.v2.patient.api.PatientDto.*;
import com.clinic.v2.patient.security.Actor;
import com.clinic.v2.patient.service.PatientService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/v2/me/patient-profile")
public class PatientController{
 private final PatientService service;public PatientController(PatientService service){this.service=service;}
 @GetMapping public ProfileView get(@AuthenticationPrincipal Actor actor){return service.own(actor);}
 @PutMapping @ResponseStatus(HttpStatus.OK) public ProfileView put(@AuthenticationPrincipal Actor actor,@Valid @RequestBody ProfileInput in){return service.upsertOwn(actor,in);}
}
