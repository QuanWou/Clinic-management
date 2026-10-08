package com.clinic.medical.api;
import com.clinic.medical.security.Actor;
import com.clinic.medical.service.PatientRecordService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController @RequestMapping("/api/me/clinics/{c}/branches/{b}/medical-records")
public class PatientRecordController {
 private final PatientRecordService service;public PatientRecordController(PatientRecordService service){this.service=service;}
 @GetMapping public List<PatientRecordService.Record> list(@AuthenticationPrincipal Actor actor,@PathVariable UUID c,@PathVariable UUID b){return service.list(actor,c,b);}
}
