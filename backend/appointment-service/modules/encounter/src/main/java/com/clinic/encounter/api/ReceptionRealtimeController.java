package com.clinic.encounter.api;
import com.clinic.encounter.security.*;
import com.clinic.realtime.PostgresRealtime;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import javax.sql.DataSource;
import java.util.UUID;
import jakarta.servlet.http.HttpServletResponse;
@RestController
public class ReceptionRealtimeController {
 private final PostgresRealtime realtime;
 private com.clinic.encounter.service.EncounterService service;private PatientOwnershipClient owner;
 public ReceptionRealtimeController(DataSource ds,com.clinic.encounter.service.EncounterService service,PatientOwnershipClient owner){this.service=service;this.owner=owner;realtime=new PostgresRealtime(ds);}
 @jakarta.annotation.PreDestroy public void close(){realtime.close();}
 
 @GetMapping(value="/api/clinics/{c}/branches/{b}/reception/events",produces="text/event-stream")
 public SseEmitter reception(@AuthenticationPrincipal Actor a,@PathVariable UUID c,@PathVariable UUID b,HttpServletResponse r){return realtime.subscribe(PostgresRealtime.channel("encounter",c,b),()->service.authorizeOperationsRealtime(a,c,b),r,error->error instanceof ApiProblem p&&p.status.is4xxClientError());}
 @GetMapping(value="/api/clinics/{c}/branches/{b}/doctor/events",produces="text/event-stream")
 public SseEmitter doctor(@AuthenticationPrincipal Actor a,@PathVariable UUID c,@PathVariable UUID b,HttpServletResponse r){if(a==null)throw ApiProblem.forbidden();return realtime.subscribe(PostgresRealtime.channel("encounter_doctor",c,b,a.id()),()->service.authorizeDoctorRealtime(a,c,b),r,error->error instanceof ApiProblem p&&p.status.is4xxClientError());}
 @GetMapping(value="/api/me/clinics/{c}/branches/{b}/events",produces="text/event-stream")
 public SseEmitter patient(@AuthenticationPrincipal Actor a,@PathVariable UUID c,@PathVariable UUID b,HttpServletResponse r){UUID patient=owner.ownPatient(a,c);return realtime.subscribe(PostgresRealtime.channel("encounter_patient",c,b,patient),()->{if(!patient.equals(owner.ownPatient(a,c)))throw ApiProblem.forbidden();},r,error->error instanceof ApiProblem p&&p.status.is4xxClientError());}

}
