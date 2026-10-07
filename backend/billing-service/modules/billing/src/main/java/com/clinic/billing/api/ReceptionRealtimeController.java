package com.clinic.billing.api;
import com.clinic.billing.security.*;
import com.clinic.billing.service.*;
import com.clinic.realtime.PostgresRealtime;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import javax.sql.DataSource;
import java.util.UUID;
import jakarta.servlet.http.HttpServletResponse;
@RestController public class ReceptionRealtimeController {
 private final PostgresRealtime realtime;private final BillingService service;private final PatientBillingIdentity owner;private final PaymentDisplayService displays;
 public ReceptionRealtimeController(DataSource ds,BillingService service,PatientBillingIdentity owner,PaymentDisplayService displays){realtime=new PostgresRealtime(ds);this.service=service;this.owner=owner;this.displays=displays;}
 @jakarta.annotation.PreDestroy public void close(){realtime.close();}
 @GetMapping(value="/api/clinics/{c}/branches/{b}/reception/events",produces="text/event-stream")
 public SseEmitter reception(@AuthenticationPrincipal Actor a,@PathVariable UUID c,@PathVariable UUID b,HttpServletResponse r){return realtime.subscribe(PostgresRealtime.channel("billing",c,b),()->service.authorizeFinanceRealtime(a,c,b),r,error->error instanceof ApiProblem p&&p.status.is4xxClientError());}
 @GetMapping(value="/api/me/clinics/{c}/branches/{b}/events",produces="text/event-stream")
 public SseEmitter patient(@AuthenticationPrincipal Actor a,@PathVariable UUID c,@PathVariable UUID b,HttpServletResponse r){UUID patient=owner.ownPatient(a,c);return realtime.subscribe(PostgresRealtime.channel("billing_patient",c,b,patient),()->{if(!patient.equals(owner.ownPatient(a,c)))throw ApiProblem.forbidden();},r,error->error instanceof ApiProblem p&&p.status.is4xxClientError());}
 @GetMapping(value="/api/public/payment-displays/{token}/events",produces="text/event-stream")
 public SseEmitter display(@PathVariable String token,HttpServletResponse r){String channel=displays.eventChannel(token);return realtime.subscribe(channel,()->{if(!channel.equals(displays.eventChannel(token)))throw ApiProblem.forbidden();},r,error->error instanceof ApiProblem p&&p.status.is4xxClientError());}
}
