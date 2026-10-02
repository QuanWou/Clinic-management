package com.clinic.v2.api;
import com.clinic.v2.security.Actor;
import com.clinic.v2.service.PatientHistoryDirectory;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController public class PatientHistoryController {
 private final PatientHistoryDirectory directory;public PatientHistoryController(PatientHistoryDirectory directory){this.directory=directory;}
 @GetMapping("/api/v2/me/patient-clinics") public List<PatientHistoryDirectory.Clinic> own(@AuthenticationPrincipal Actor actor,@RequestHeader("Authorization") String bearer){return directory.own(actor,bearer);}
}
