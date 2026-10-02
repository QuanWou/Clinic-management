package com.clinic.v2.medical.api;
import com.clinic.v2.medical.service.PatientFollowUpService;
import com.clinic.v2.medical.security.Actor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController @RequestMapping("/api/v2/me/clinics/{c}/branches/{b}")
public class PatientFollowUpController {
 private final PatientFollowUpService service;public PatientFollowUpController(PatientFollowUpService service){this.service=service;}
 @GetMapping("/follow-up-plans") public List<PatientFollowUpService.Plan> list(@AuthenticationPrincipal Actor actor,@PathVariable UUID c,@PathVariable UUID b){return service.list(actor,c,b);}
 @GetMapping("/visits/{id}/follow-up-proof") public PatientFollowUpService.Proof proof(@AuthenticationPrincipal Actor actor,@PathVariable UUID c,@PathVariable UUID b,@PathVariable UUID id){return service.proof(actor,c,b,id);}
}
