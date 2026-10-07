package com.clinic.notification.api;
import com.clinic.notification.security.Actor;
import com.clinic.notification.NotificationService;
import com.clinic.realtime.PostgresRealtime;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import javax.sql.DataSource;
import jakarta.servlet.http.HttpServletResponse;
@RestController public class RealtimeController {
 private final PostgresRealtime realtime;private final NotificationService service;
 public RealtimeController(DataSource ds,NotificationService service){realtime=new PostgresRealtime(ds);this.service=service;}
 @jakarta.annotation.PreDestroy public void close(){realtime.close();}
 @GetMapping(value="/api/me/notifications/events",produces="text/event-stream")
 public SseEmitter mine(@AuthenticationPrincipal Actor a,HttpServletResponse r){if(a==null)throw ApiProblem.forbidden();return realtime.subscribe(PostgresRealtime.channel("notification_user",a.id()),()->service.preference(a),r,error->error instanceof ApiProblem p&&p.status.is4xxClientError());}
}
