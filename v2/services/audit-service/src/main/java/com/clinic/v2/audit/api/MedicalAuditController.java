package com.clinic.v2.audit.api;
import com.clinic.v2.audit.api.AuditDto.EventEnvelopeInput;
import com.clinic.v2.audit.security.WorkloadPrincipal;
import com.clinic.v2.audit.service.MedicalAuditConsumer;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController public class MedicalAuditController{
 private final MedicalAuditConsumer consumer;public MedicalAuditController(MedicalAuditConsumer c){consumer=c;}
 @PostMapping("/api/v2/internal/audit/medical-events") public boolean accept(@AuthenticationPrincipal WorkloadPrincipal p,@Valid @RequestBody EventEnvelopeInput e){return consumer.accept(p,e);}
}
