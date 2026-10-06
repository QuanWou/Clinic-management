package com.clinic.audit.api;
import com.clinic.audit.api.AuditDto.EventEnvelopeInput;
import com.clinic.audit.security.WorkloadPrincipal;
import com.clinic.audit.service.MedicalAuditConsumer;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController public class MedicalAuditController{
 private final MedicalAuditConsumer consumer;public MedicalAuditController(MedicalAuditConsumer c){consumer=c;}
 @PostMapping("/api/internal/audit/medical-events") public boolean accept(@AuthenticationPrincipal WorkloadPrincipal p,@Valid @RequestBody EventEnvelopeInput e){return consumer.accept(p,e);}
}
