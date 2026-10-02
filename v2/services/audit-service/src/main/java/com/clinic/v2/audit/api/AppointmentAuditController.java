package com.clinic.v2.audit.api;
import com.clinic.v2.audit.api.AuditDto.EventEnvelopeInput;
import com.clinic.v2.audit.security.WorkloadPrincipal;
import com.clinic.v2.audit.service.AppointmentAuditConsumer;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@RestController public class AppointmentAuditController{
 private final AppointmentAuditConsumer consumer;public AppointmentAuditController(AppointmentAuditConsumer consumer){this.consumer=consumer;}
 @PostMapping("/api/v2/internal/audit/appointment-events") public Map<String,Boolean> accept(@AuthenticationPrincipal WorkloadPrincipal principal,@Valid @RequestBody EventEnvelopeInput event){return Map.of("applied",consumer.accept(principal,event));}
}
