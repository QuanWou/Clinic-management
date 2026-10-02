package com.clinic.v2.iam.api;

import com.clinic.v2.iam.api.IamDto.*;
import com.clinic.v2.iam.security.*;
import com.clinic.v2.iam.service.MembershipService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/v2")
public class MembershipController {
    private final MembershipService memberships;
    private final SessionSecurityService sessions;

    public MembershipController(MembershipService memberships, SessionSecurityService sessions) {
        this.memberships = memberships;
        this.sessions = sessions;
    }

    @GetMapping("/me/current")
    public CurrentActor current(@AuthenticationPrincipal Actor actor) {
        PlatformDecision platform = memberships.platform(actor.id());
        return new CurrentActor(actor.id(), actor.roles(), platform.allowed());
    }

    @GetMapping("/me/contexts")
    public List<ContextView> contexts(@AuthenticationPrincipal Actor actor) {
        return memberships.contexts(actor);
    }

    @GetMapping("/me/invitations")
    public List<MembershipView> ownInvitations(@AuthenticationPrincipal Actor actor) {
        return memberships.ownInvitations(actor);
    }

    @PostMapping({"/sessions/logout", "/sessions/revoke-current"})
    public SessionRevoked revokeCurrent(@AuthenticationPrincipal Actor actor) {
        Instant now = Instant.now();
        long version = sessions.revokeBefore(actor.id(), now);
        return new SessionRevoked(version, now);
    }

    @GetMapping("/clinics/{clinicId}/memberships")
    public List<MembershipView> list(@AuthenticationPrincipal Actor actor, @PathVariable UUID clinicId) {
        return memberships.clinicMemberships(actor, clinicId);
    }

    @PostMapping("/clinics/{clinicId}/memberships")
    @ResponseStatus(HttpStatus.CREATED)
    public MembershipView invite(@AuthenticationPrincipal Actor actor, @PathVariable UUID clinicId,
                                 @Valid @RequestBody CreateMembership input) {
        return memberships.invite(actor, clinicId, input);
    }

    @PostMapping("/memberships/{membershipId}/activate")
    public MembershipView activate(@AuthenticationPrincipal Actor actor, @PathVariable UUID membershipId) {
        return memberships.activateOwnInvite(actor, membershipId);
    }

    @PostMapping("/clinics/{clinicId}/memberships/{membershipId}/branches")
    public MembershipView grantBranch(@AuthenticationPrincipal Actor actor, @PathVariable UUID clinicId,
                                      @PathVariable UUID membershipId, @Valid @RequestBody GrantBranch input) {
        return memberships.grantBranch(actor, clinicId, membershipId, input);
    }

    @PostMapping("/clinics/{clinicId}/memberships/{membershipId}/branches/{branchId}/revoke")
    public MembershipView revokeBranch(@AuthenticationPrincipal Actor actor, @PathVariable UUID clinicId,
                                       @PathVariable UUID membershipId, @PathVariable UUID branchId,
                                       @Valid @RequestBody Reason input) {
        return memberships.revokeBranch(actor, clinicId, membershipId, branchId, input);
    }

    @PostMapping("/clinics/{clinicId}/memberships/{membershipId}/revoke")
    public MembershipView revoke(@AuthenticationPrincipal Actor actor, @PathVariable UUID clinicId,
                                 @PathVariable UUID membershipId, @Valid @RequestBody Reason input) {
        return memberships.revoke(actor, clinicId, membershipId, input);
    }
}
