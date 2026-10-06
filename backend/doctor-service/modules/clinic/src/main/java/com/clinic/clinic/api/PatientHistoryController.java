package com.clinic.clinic.api;
import com.clinic.clinic.security.Actor;
import com.clinic.clinic.service.PatientHistoryDirectory;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController public class PatientHistoryController {
 private final PatientHistoryDirectory directory;public PatientHistoryController(PatientHistoryDirectory directory){this.directory=directory;}
 @GetMapping("/api/me/patient-clinics") public List<PatientHistoryDirectory.Clinic> own(@AuthenticationPrincipal Actor actor,@RequestHeader("Authorization") String bearer){return directory.own(actor,bearer);}
}
