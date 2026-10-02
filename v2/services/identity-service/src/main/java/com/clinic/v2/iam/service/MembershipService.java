package com.clinic.v2.iam.service;

import com.clinic.v2.iam.api.*;
import com.clinic.v2.iam.api.IamDto.*;
import com.clinic.v2.iam.domain.*;
import com.clinic.v2.iam.repo.*;
import com.clinic.v2.iam.security.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
public class MembershipService {
    private final MembershipRepository memberships;
    private final BranchGrantRepository grants;
    private final MembershipEventRepository events;
    private final PlatformOperatorRepository platformOperators;
    private final DatabaseScope scope;
    private final ClinicDirectoryClient clinicDirectory;

    public MembershipService(MembershipRepository memberships,
                             BranchGrantRepository grants,
                             MembershipEventRepository events,
                             PlatformOperatorRepository platformOperators,
                             DatabaseScope scope,
                             ClinicDirectoryClient clinicDirectory) {
        this.memberships = memberships;
        this.grants = grants;
        this.events = events;
        this.platformOperators = platformOperators;
        this.scope = scope;
        this.clinicDirectory = clinicDirectory;
    }

    @Transactional(readOnly = true)
    public List<ContextView> contexts(Actor actor) {
        return contextsForUser(actor.id());
    }

    @Transactional(readOnly=true)
    public List<MembershipView> ownInvitations(Actor actor) {
        scope.user(actor.id());
        return memberships.findByUserIdAndStatusOrderByClinicId(actor.id(),MembershipStatus.INVITED)
            .stream().map(this::view).toList();
    }

    @Transactional(readOnly = true)
    public List<ContextView> contextsForUser(UUID userId) {
        scope.user(userId);
        return memberships.findByUserIdAndStatusOrderByClinicId(userId, MembershipStatus.ACTIVE)
            .stream().map(this::contextView).toList();
    }

    @Transactional(readOnly = true)
    public List<MembershipView> clinicMemberships(Actor actor, UUID clinicId) {
        activateClinicScope(actor.id(), clinicId, null, Capability.MEMBERSHIP_READ);
        List<Membership> active = memberships.findByClinicIdAndStatusOrderByInvitedAt(clinicId, MembershipStatus.ACTIVE);
        List<Membership> invited = memberships.findByClinicIdAndStatusOrderByInvitedAt(clinicId, MembershipStatus.INVITED);
        List<Membership> all = new ArrayList<>(active);
        all.addAll(invited);
        return all.stream().map(this::view).toList();
    }

    @Transactional
    public MembershipView invite(Actor actor, UUID clinicId, CreateMembership input) {
        if (input.role() == MembershipRole.CLINIC_OWNER)
            throw ApiProblem.invalid("Owner transfer is not implemented in S0-03");

        Membership caller = activateClinicScope(actor.id(), clinicId, null, Capability.MEMBERSHIP_MANAGE);
        if (!clinicDirectory.clinicExists(clinicId)) throw ApiProblem.missing();
        if (caller.role == MembershipRole.CLINIC_MANAGER && input.role() == MembershipRole.CLINIC_MANAGER)
            throw ApiProblem.forbidden();

        Membership m = new Membership();
        m.userId = input.userId();
        m.clinicId = clinicId;
        m.role = input.role();
        m.status = MembershipStatus.INVITED;
        m.allBranches = input.allBranches();
        m.invitedBy = actor.id();
        memberships.saveAndFlush(m);
        event(actor.id(), m, "INVITED", reason(input.reason(), "Staff membership invited"));
        return view(m);
    }

    @Transactional
    public MembershipView activateOwnInvite(Actor actor, UUID membershipId) {
        scope.user(actor.id());
        Membership m = memberships.lockById(membershipId).orElseThrow(ApiProblem::missing);
        if (!m.userId.equals(actor.id())) throw ApiProblem.missing();
        if (m.status != MembershipStatus.INVITED)
            throw ApiProblem.conflict("Only an invited membership may be activated");

        // Event inserts are clinic-scoped; tenant context is set only after we
        // resolved an invite owned by the authenticated actor.
        scope.userAndClinic(actor.id(), m.clinicId);
        m.status = MembershipStatus.ACTIVE;
        m.activatedAt = Instant.now();
        memberships.saveAndFlush(m);
        event(actor.id(), m, "ACTIVATED", "Invite accepted by target user");
        return view(m);
    }

    @Transactional
    public MembershipView grantBranch(Actor actor, UUID clinicId, UUID membershipId, GrantBranch input) {
        activateClinicScope(actor.id(), clinicId, null, Capability.MEMBERSHIP_MANAGE);
        if (!clinicDirectory.branchExists(clinicId, input.branchId())) throw ApiProblem.missing();

        Membership target = memberships.findByIdAndClinicId(membershipId, clinicId).orElseThrow(ApiProblem::missing);
        if (target.status == MembershipStatus.REVOKED)
            throw ApiProblem.conflict("Revoked membership cannot receive grants");
        if (target.allBranches)
            throw ApiProblem.conflict("Membership already covers all branches");

        BranchGrant g = grants.findByMembershipIdAndBranchId(membershipId, input.branchId()).orElseGet(BranchGrant::new);
        if (g.id != null && g.active) return view(target);
        g.membershipId = target.id;
        g.userId = target.userId;
        g.clinicId = target.clinicId;
        g.branchId = input.branchId();
        g.active = true;
        g.grantedBy = actor.id();
        g.grantedAt = Instant.now();
        g.revokedBy = null;
        g.revokedAt = null;
        grants.saveAndFlush(g);
        bumpMembershipVersion(target);
        event(actor.id(), target, "BRANCH_GRANTED", reason(input.reason(), "Branch grant added"));
        return view(target);
    }

    @Transactional
    public MembershipView revokeBranch(Actor actor, UUID clinicId, UUID membershipId, UUID branchId, Reason input) {
        activateClinicScope(actor.id(), clinicId, null, Capability.MEMBERSHIP_MANAGE);
        Membership target = memberships.findByIdAndClinicId(membershipId, clinicId).orElseThrow(ApiProblem::missing);
        BranchGrant g = grants.findByMembershipIdAndBranchId(membershipId, branchId).orElseThrow(ApiProblem::missing);
        if (!g.active) return view(target);
        g.active = false;
        g.revokedBy = actor.id();
        g.revokedAt = Instant.now();
        grants.saveAndFlush(g);
        bumpMembershipVersion(target);
        event(actor.id(), target, "BRANCH_REVOKED", input.reason().trim());
        return view(target);
    }

    @Transactional
    public MembershipView revoke(Actor actor, UUID clinicId, UUID membershipId, Reason input) {
        Membership caller = activateClinicScope(actor.id(), clinicId, null, Capability.MEMBERSHIP_MANAGE);
        Membership target = memberships.lockById(membershipId).orElseThrow(ApiProblem::missing);
        if (!target.clinicId.equals(clinicId)) throw ApiProblem.missing();
        if (target.role == MembershipRole.CLINIC_OWNER)
            throw ApiProblem.invalid("Owner transfer/revocation requires a separate approved ownership workflow");
        if (caller.role == MembershipRole.CLINIC_MANAGER && target.role == MembershipRole.CLINIC_MANAGER)
            throw ApiProblem.forbidden();
        if (target.status == MembershipStatus.REVOKED) return view(target);

        target.status = MembershipStatus.REVOKED;
        target.revokedBy = actor.id();
        target.revokedAt = Instant.now();
        target.revokeReason = input.reason().trim();
        memberships.saveAndFlush(target);
        event(actor.id(), target, "REVOKED", input.reason().trim());
        return view(target);
    }

    @Transactional
    public MembershipView bootstrapOwner(UUID clinicId, UUID ownerUserId) {
        // The calling workload is trusted only to request a bootstrap. The
        // Clinic owner source of truth must independently confirm the pair.
        if (!clinicDirectory.clinicOwnedBy(clinicId, ownerUserId)) throw ApiProblem.forbidden();

        scope.userAndClinic(ownerUserId, clinicId);
        List<Membership> existing = memberships.findByUserIdAndClinicIdAndStatusOrderByInvitedAt(
            ownerUserId, clinicId, MembershipStatus.ACTIVE);
        Membership owner = existing.stream()
            .filter(x -> x.role == MembershipRole.CLINIC_OWNER).findFirst().orElse(null);
        if (owner != null) return view(owner);
        if (!existing.isEmpty())
            throw ApiProblem.conflict("Active non-owner membership already exists for creator");

        Membership m = new Membership();
        m.userId = ownerUserId;
        m.clinicId = clinicId;
        m.role = MembershipRole.CLINIC_OWNER;
        m.status = MembershipStatus.ACTIVE;
        m.allBranches = true;
        m.invitedBy = ownerUserId;
        m.activatedAt = Instant.now();
        memberships.saveAndFlush(m);
        event(ownerUserId, m, "OWNER_BOOTSTRAPPED", "Clinic creator linked as initial owner");
        return view(m);
    }

    @Transactional(readOnly = true)
    public AuthorizationDecision authorize(AuthorizationRequest input) {
        if (input.capability() == Capability.PLATFORM_CLINIC_REVIEW) {
            PlatformDecision p = platform(input.actorUserId());
            return p.allowed()
                ? new AuthorizationDecision(true, null, null, p.version(), "ACTIVE_PLATFORM_CAPABILITY")
                : new AuthorizationDecision(false, null, null, 0, "NO_PLATFORM_CAPABILITY");
        }
        if (input.clinicId() == null)
            return new AuthorizationDecision(false, null, null, 0, "CLINIC_CONTEXT_REQUIRED");

        Membership m = activateClinicScopeOrNull(
            input.actorUserId(), input.clinicId(), input.branchId(), input.capability());
        if (m == null)
            return new AuthorizationDecision(false, null, null, 0, "NO_ACTIVE_GRANT");
        return new AuthorizationDecision(true, m.id, m.role, m.version, "ACTIVE_MEMBERSHIP");
    }

    @Transactional(readOnly = true)
    public PlatformDecision platform(UUID userId) {
        return platformOperators.findById(userId)
            .filter(p -> p.active)
            .map(p -> new PlatformDecision(true, p.version))
            .orElseGet(() -> new PlatformDecision(false, 0));
    }

    private Membership activateClinicScope(UUID userId, UUID clinicId, UUID branchId, Capability capability) {
        Membership membership = activateClinicScopeOrNull(userId, clinicId, branchId, capability);
        if (membership == null) throw ApiProblem.forbidden();
        return membership;
    }

    private Membership activateClinicScopeOrNull(UUID userId, UUID clinicId, UUID branchId, Capability capability) {
        // Start with user-only RLS. A caller-provided clinic UUID is not allowed
        // to become the DB tenant context until an active grant proves it.
        scope.user(userId);
        Membership membership = requireCapability(userId, clinicId, branchId, capability);
        if (membership == null) return null;
        scope.userAndClinic(userId, clinicId);
        return membership;
    }

    private Membership requireCapability(UUID userId, UUID clinicId, UUID branchId, Capability capability) {
        List<Membership> active = memberships.findByUserIdAndClinicIdAndStatusOrderByInvitedAt(
            userId, clinicId, MembershipStatus.ACTIVE);
        for (Membership m : active) {
            if (!capabilities(m.role).contains(capability)) continue;
            if (branchId == null) {
                // Membership existence/read can be resolved without selecting a
                // branch. Clinic-wide mutation capabilities require an
                // all-branches grant; a branch-scoped manager must send the
                // branch and is checked against that grant.
                if (capability == Capability.CLINIC_MEMBER || capability == Capability.CLINIC_READ || m.allBranches) {
                    return m;
                }
                continue;
            }
            if (m.allBranches) return m;
            boolean branchAllowed = grants.findByMembershipIdAndActiveTrueOrderByBranchId(m.id)
                .stream().anyMatch(g -> g.branchId.equals(branchId));
            if (branchAllowed) return m;
        }
        return null;
    }

    private Set<Capability> capabilities(MembershipRole role) {
        return switch (role) {
            case CLINIC_OWNER -> EnumSet.complementOf(EnumSet.of(Capability.PLATFORM_CLINIC_REVIEW));
            case CLINIC_MANAGER -> EnumSet.of(Capability.CLINIC_MEMBER, Capability.CLINIC_READ,
                Capability.CLINIC_CONFIG, Capability.MEMBERSHIP_READ, Capability.MEMBERSHIP_MANAGE,
                Capability.CATALOG_READ, Capability.CATALOG_MANAGE, Capability.SCHEDULE_READ,
                Capability.SCHEDULE_MANAGE, Capability.RECEPTION, Capability.BILLING);
            case RECEPTIONIST -> EnumSet.of(Capability.CLINIC_MEMBER, Capability.CLINIC_READ,
                Capability.RECEPTION, Capability.CATALOG_READ, Capability.SCHEDULE_READ,
                Capability.SCHEDULE_MANAGE);
            case CASHIER -> EnumSet.of(Capability.CLINIC_MEMBER, Capability.CLINIC_READ,
                Capability.BILLING, Capability.CATALOG_READ);
            case DOCTOR -> EnumSet.of(Capability.CLINIC_MEMBER, Capability.CLINIC_READ,
                Capability.DOCTOR_WORK, Capability.CATALOG_READ, Capability.SCHEDULE_READ,
                Capability.SCHEDULE_MANAGE);
            case NURSE -> EnumSet.of(Capability.CLINIC_MEMBER, Capability.CLINIC_READ,
                Capability.DOCTOR_WORK, Capability.SCHEDULE_READ);
            case LAB -> EnumSet.of(Capability.CLINIC_MEMBER, Capability.CLINIC_READ,
                Capability.LAB_WORK, Capability.CATALOG_READ);
        };
    }

    private ContextView contextView(Membership m) {
        return new ContextView(m.id, m.clinicId, m.role, m.allBranches,
            m.allBranches ? List.of() : grants.findByMembershipIdAndActiveTrueOrderByBranchId(m.id)
                .stream().map(g -> g.branchId).toList(),
            m.version);
    }

    private MembershipView view(Membership m) {
        return new MembershipView(m.id, m.userId, m.clinicId, m.role, m.status, m.allBranches,
            m.version,
            m.allBranches ? List.of() : grants.findByMembershipIdAndActiveTrueOrderByBranchId(m.id)
                .stream().map(g -> g.branchId).toList(),
            m.activatedAt, m.revokedAt);
    }

    private void bumpMembershipVersion(Membership membership) {
        // Branch grants are part of the authorization snapshot. Force the
        // membership version to change so permission caches cannot retain a
        // stale branch grant after grant/revoke.
        membership.updatedAt = Instant.now();
        memberships.saveAndFlush(membership);
    }

    private void event(UUID actor, Membership target, String action, String reason) {
        MembershipEvent e = new MembershipEvent();
        e.clinicId = target.clinicId;
        e.membershipId = target.id;
        e.actorUserId = actor;
        e.targetUserId = target.userId;
        e.action = action;
        e.reason = reason;
        events.save(e);
    }

    private String reason(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
