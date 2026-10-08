package com.clinic.audit.api;

import com.clinic.audit.api.AuditDto.AdminAuditView;
import com.clinic.audit.security.*;
import com.clinic.audit.service.AuditService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/clinics/{clinicId}/audit-events")
public class AdminAuditController {
    private final AuditService audit;
    private final IamAuthorizationClient iam;

    public AdminAuditController(AuditService audit,IamAuthorizationClient iam){
        this.audit=audit;this.iam=iam;
    }

    @GetMapping
    public List<AdminAuditView> list(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,
                                     @RequestParam(defaultValue="100") int limit){
        if(actor==null||!iam.allowed(actor.id(),"AUDIT_VIEW",clinicId))throw ApiProblem.accessDenied();
        return audit.adminFeed(clinicId,limit);
    }
}
