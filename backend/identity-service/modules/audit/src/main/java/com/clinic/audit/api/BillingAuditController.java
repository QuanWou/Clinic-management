package com.clinic.audit.api;
import com.clinic.audit.api.AuditDto.EventEnvelopeInput;
import com.clinic.audit.security.WorkloadPrincipal;
import com.clinic.audit.service.BillingAuditConsumer;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController public class BillingAuditController{
 private final BillingAuditConsumer consumer;public BillingAuditController(BillingAuditConsumer c){consumer=c;}
 @PostMapping("/api/internal/audit/billing-events") public boolean accept(@AuthenticationPrincipal WorkloadPrincipal p,@Valid @RequestBody EventEnvelopeInput e){return consumer.accept(p,e);}
}
