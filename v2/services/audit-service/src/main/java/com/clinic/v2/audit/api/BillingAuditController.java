package com.clinic.v2.audit.api;
import com.clinic.v2.audit.api.AuditDto.EventEnvelopeInput;
import com.clinic.v2.audit.security.WorkloadPrincipal;
import com.clinic.v2.audit.service.BillingAuditConsumer;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController public class BillingAuditController{
 private final BillingAuditConsumer consumer;public BillingAuditController(BillingAuditConsumer c){consumer=c;}
 @PostMapping("/api/v2/internal/audit/billing-events") public boolean accept(@AuthenticationPrincipal WorkloadPrincipal p,@Valid @RequestBody EventEnvelopeInput e){return consumer.accept(p,e);}
}
