package com.clinic.appointment.api;
import com.clinic.appointment.security.*;
import com.clinic.appointment.source.PatientSourceClient;
import com.clinic.realtime.PostgresRealtime;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import javax.sql.DataSource;
import java.util.UUID;
import jakarta.servlet.http.HttpServletResponse;
@RestController public class ReceptionRealtimeController {
 private final PostgresRealtime realtime;private final BillingSourceAuthorization authorization;private final PatientSourceClient patients;
 public ReceptionRealtimeController(DataSource ds,BillingSourceAuthorization authorization,PatientSourceClient patients){realtime=new PostgresRealtime(ds);this.authorization=authorization;this.patients=patients;}
 @jakarta.annotation.PreDestroy public void close(){realtime.close();}
 @GetMapping(value="/api/clinics/{c}/branches/{b}/reception/events",produces="text/event-stream")
 public SseEmitter reception(@AuthenticationPrincipal Actor a,@PathVariable UUID c,@PathVariable UUID b,HttpServletResponse r){if(a==null)throw ApiProblem.forbidden();return realtime.subscribe(PostgresRealtime.channel("appointment",c,b),()->authorization.requireOperationalRead(a.id(),c,b),r,error->error instanceof ApiProblem p&&p.status.is4xxClientError());}
 @GetMapping(value="/api/me/appointment-events",produces="text/event-stream")
 public SseEmitter patient(@AuthenticationPrincipal Actor a,@RequestParam UUID clinicId,@RequestParam UUID patientId,HttpServletResponse r){return realtime.subscribe(PostgresRealtime.channel("appointment_patient",clinicId,patientId),()->{if(a==null||!a.id().equals(patients.booking(patientId).platformUserId()))throw ApiProblem.forbidden();},r,error->error instanceof ApiProblem p&&p.status.is4xxClientError());}
}
