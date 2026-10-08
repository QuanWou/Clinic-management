package com.clinic.medical.api;
import com.clinic.medical.security.*;
import com.clinic.medical.service.MedicalService;
import com.clinic.realtime.PostgresRealtime;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import javax.sql.DataSource;
import java.util.UUID;
import jakarta.servlet.http.HttpServletResponse;
@RestController public class RealtimeController {
 private final PostgresRealtime realtime;private final MedicalService service;private final PatientOwnershipClient owner;
 public RealtimeController(DataSource ds,MedicalService service,PatientOwnershipClient owner){realtime=new PostgresRealtime(ds);this.service=service;this.owner=owner;}
 @jakarta.annotation.PreDestroy public void close(){realtime.close();}
 @GetMapping(value="/api/clinics/{c}/branches/{b}/doctor/events",produces="text/event-stream")
 public SseEmitter doctor(@AuthenticationPrincipal Actor a,@PathVariable UUID c,@PathVariable UUID b,HttpServletResponse r){if(a==null)throw ApiProblem.forbidden();return realtime.subscribe(PostgresRealtime.channel("medical_doctor",c,b,a.id()),()->service.authorizeDoctorRealtime(a,c,b),r,error->error instanceof ApiProblem p&&p.status.is4xxClientError());}
 @GetMapping(value="/api/me/clinics/{c}/branches/{b}/events",produces="text/event-stream")
 public SseEmitter patient(@AuthenticationPrincipal Actor a,@PathVariable UUID c,@PathVariable UUID b,HttpServletResponse r){UUID patient=owner.ownPatient(a,c);return realtime.subscribe(PostgresRealtime.channel("medical_patient",c,b,patient),()->{if(!patient.equals(owner.ownPatient(a,c)))throw ApiProblem.forbidden();},r,error->error instanceof ApiProblem p&&p.status.is4xxClientError());}
}
