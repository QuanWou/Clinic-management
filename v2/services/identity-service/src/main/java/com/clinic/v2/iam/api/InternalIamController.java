package com.clinic.v2.iam.api;

import com.clinic.v2.iam.api.IamDto.*;
import com.clinic.v2.iam.security.WorkloadPrincipal;
import com.clinic.v2.iam.service.MembershipService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v2/internal/iam")
public class InternalIamController {
    private final MembershipService memberships;

    public InternalIamController(MembershipService memberships) {
        this.memberships = memberships;
    }

    @PostMapping("/authorization/check")
    public AuthorizationDecision authorize(@AuthenticationPrincipal WorkloadPrincipal workload,
                                           @Valid @RequestBody AuthorizationRequest input) {
        require(workload, "iam.authorize");
        return memberships.authorize(input);
    }

    @GetMapping("/users/{userId}/contexts")
    public java.util.List<ContextView> contexts(@AuthenticationPrincipal WorkloadPrincipal workload,
                                                @PathVariable java.util.UUID userId) {
        require(workload, "iam.contexts.read");
        return memberships.contextsForUser(userId);
    }

    @PostMapping("/owners")
    public MembershipView provisionOwner(@AuthenticationPrincipal WorkloadPrincipal workload,
                                         @Valid @RequestBody OwnerProvisionRequest input) {
        require(workload, "iam.owner.provision");
        return memberships.bootstrapOwner(input.clinicId(), input.userId());
    }

    private void require(WorkloadPrincipal workload, String scope) {
        if (workload == null || !workload.hasScope(scope)) {
            throw ApiProblem.forbidden();
        }
    }
}
