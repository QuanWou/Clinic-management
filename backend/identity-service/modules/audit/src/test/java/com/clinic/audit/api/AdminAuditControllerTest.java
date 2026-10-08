package com.clinic.audit.api;

import com.clinic.audit.api.AuditDto.AdminAuditView;
import com.clinic.audit.security.*;
import com.clinic.audit.service.AuditService;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AdminAuditControllerTest {
    @Test
    void deniesBeforeReadingWhenAuditCapabilityIsMissing(){
        AuditService audit=mock(AuditService.class);
        IamAuthorizationClient iam=mock(IamAuthorizationClient.class);
        AdminAuditController controller=new AdminAuditController(audit,iam);
        Actor actor=new Actor(UUID.randomUUID(),Set.of());
        UUID clinic=UUID.randomUUID();
        when(iam.allowed(actor.id(),"AUDIT_VIEW",clinic)).thenReturn(false);

        ApiProblem problem=assertThrows(ApiProblem.class,()->controller.list(actor,clinic,100));

        assertEquals("FORBIDDEN",problem.code);
        verifyNoInteractions(audit);
    }

    @Test
    void returnsOnlyTheSanitizedAdminProjectionWhenAuthorized(){
        AuditService audit=mock(AuditService.class);
        IamAuthorizationClient iam=mock(IamAuthorizationClient.class);
        AdminAuditController controller=new AdminAuditController(audit,iam);
        Actor actor=new Actor(UUID.randomUUID(),Set.of());
        UUID clinic=UUID.randomUUID(),branch=UUID.randomUUID(),eventId=UUID.randomUUID();
        AdminAuditView view=new AdminAuditView(eventId,branch,actor.id(),"SYSTEM",
            "clinic.billing.shift_approved.v1","billing",UUID.randomUUID().toString(),
            "SUCCESS","corr-1",Instant.parse("2026-10-06T10:00:00Z"));
        when(iam.allowed(actor.id(),"AUDIT_VIEW",clinic)).thenReturn(true);
        when(audit.adminFeed(clinic,100)).thenReturn(List.of(view));

        assertEquals(List.of(view),controller.list(actor,clinic,100));
        verify(audit).adminFeed(clinic,100);
    }
}
