package com.clinic.v2.iam.service;

import com.clinic.v2.iam.api.ApiProblem;
import com.clinic.v2.iam.api.IamDto.*;
import com.clinic.v2.iam.client.ClinicDirectoryClient;
import com.clinic.v2.iam.domain.*;
import com.clinic.v2.iam.repo.*;
import com.clinic.v2.iam.security.Actor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
public class MembershipService {
    private final MembershipRepository memberships;
    private final BranchGrantRepository branchGrants;
    private final PlatformGrantRepository platformGrants;
    private final PermissionEpochRepository epochs;
    private final SecurityEventRepository events;
    private final ClinicDirectoryClient clinics;

    public MembershipService(MembershipRepository memberships, BranchGrantRepository branchGrants,
            PlatformGrantRepository platformGrants, PermissionEpochRepository epochs,
            SecurityEventRepository events, ClinicDirectoryClient clinics) {
        this.memberships=memberships;this.branchGrants=branchGrants;this.platformGrants=platformGrants;
        this.epochs=epochs;this.events=events;this.clinics=clinics;
    }

    @Transactional(readOnly=true)
    public List<ContextSummary> contexts(Actor actor) {
        Map<UUID,List<Membership>> grouped=new LinkedHashMap<>();
        for(Membership m:memberships.findByUserIdAndStatusOrderByClinicIdAscRoleAsc(actor.id(),MembershipStatus.ACTIVE))
            grouped.computeIfAbsent(m.clinicId,k->new ArrayList<>()).add(m);
        long epoch=epoch(actor.id());
        List<ContextSummary> result=new ArrayList<>();
        for(var e:grouped.entrySet()){
            Set<MembershipRole> roles=new LinkedHashSet<>();
            Set<UUID> branchIds=new LinkedHashSet<>();
            boolean all=false;
            for(Membership m:e.getValue()){
                roles.add(m.role); all|=m.allBranches;
                branchGrants.findByMembershipId(m.id).forEach(g->branchIds.add(g.branchId));
            }
            result.add(new ContextSummary(e.getKey(),Set.copyOf(roles),all,Set.copyOf(branchIds),epoch));
        }
        return result;
    }

    @Transactional(readOnly=true)
    public ClinicContext resolve(Actor actor,UUID clinicId,UUID branchId) {
        requireBranchExists(clinicId,branchId);
        Set<MembershipRole> roles=new LinkedHashSet<>();
        for(Membership m:memberships.activeForContext(actor.id(),clinicId)) {
            if(m.allBranches || branchGrants.existsByMembershipIdAndBranchId(m.id,branchId)) roles.add(m.role);
        }
        if(roles.isEmpty()) throw ApiProblem.forbidden();
        return new ClinicContext(clinicId,branchId,Set.copyOf(roles),epoch(actor.id()));
    }

    @Transactional
    public MembershipView create(Actor actor,MembershipInput input) {
        requireMembershipAdmin(actor,input.clinicId());
        validateScope(input.clinicId(),input.allBranches(),input.branchIds());

        Membership m=memberships.findByUserIdAndClinicIdAndRole(input.userId(),input.clinicId(),input.role()).orElse(null);
        if(m==null){
            m=new Membership();m.userId=input.userId();m.clinicId=input.clinicId();m.role=input.role();
            m.createdBy=actor.id();m.status=MembershipStatus.ACTIVE;m.version=1;
        }else{
            if(m.status==MembershipStatus.ACTIVE) throw ApiProblem.conflict("An active membership for this role already exists");
            m.status=MembershipStatus.ACTIVE;m.revokedAt=null;m.revokedBy=null;m.version++;
        }
        m.allBranches=input.allBranches();
        memberships.saveAndFlush(m);
        replaceBranchGrants(m,input.branchIds());
        bump(input.userId());
        audit(actor.id(),null,input.userId(),input.clinicId(),m.id,"MEMBERSHIP_GRANTED",input.reason());
        return view(m);
    }

    @Transactional
    public MembershipView updateScope(Actor actor,UUID membershipId,BranchScopeInput input) {
        Membership m=memberships.lockById(membershipId).orElseThrow(ApiProblem::missing);
        requireMembershipAdmin(actor,m.clinicId);
        if(m.status!=MembershipStatus.ACTIVE) throw ApiProblem.conflict("Revoked membership cannot be edited");
        validateScope(m.clinicId,input.allBranches(),input.branchIds());
        m.allBranches=input.allBranches();m.version++;
        replaceBranchGrants(m,input.branchIds());
        bump(m.userId);
        audit(actor.id(),null,m.userId,m.clinicId,m.id,"MEMBERSHIP_SCOPE_CHANGED",input.reason());
        return view(m);
    }

    @Transactional
    public MembershipView revoke(Actor actor,UUID membershipId,RevokeInput input) {
        Membership m=memberships.lockById(membershipId).orElseThrow(ApiProblem::missing);
        requireMembershipAdmin(actor,m.clinicId);
        if(m.status!=MembershipStatus.ACTIVE) return view(m);
        if(m.userId.equals(actor.id()) && m.role==MembershipRole.CLINIC_OWNER)
            throw ApiProblem.conflict("An owner cannot revoke their own owner grant");
        m.status=MembershipStatus.REVOKED;m.revokedBy=actor.id();m.revokedAt=Instant.now();m.version++;
        bump(m.userId);
        audit(actor.id(),null,m.userId,m.clinicId,m.id,"MEMBERSHIP_REVOKED",input.reason());
        return view(m);
    }

    @Transactional(readOnly=true)
    public List<MembershipView> listClinic(Actor actor,UUID clinicId) {
        requireMembershipAdmin(actor,clinicId);
        return memberships.findByClinicIdAndStatusOrderByUserIdAscRoleAsc(clinicId,MembershipStatus.ACTIVE)
            .stream().map(this::view).toList();
    }

    @Transactional
    public MembershipView provisionOwner(String workloadSubject,OwnerProvisionRequest input) {
        return ensurePrimaryOwner(null,workloadSubject,input.userId(),input.clinicId(),input.reason());
    }

    @Transactional
    public MembershipView claimPrimaryOwner(Actor actor,UUID clinicId) {
        return ensurePrimaryOwner(actor.id(),null,actor.id(),clinicId,"Authenticated clinic creator claimed owner context");
    }

    private MembershipView ensurePrimaryOwner(UUID actorUserId,String workloadSubject,UUID userId,UUID clinicId,String reason) {
        var scope=clinics.clinicScope(clinicId,Set.of());
        if(scope==null || !scope.exists() || !clinicId.equals(scope.clinicId()) || !userId.equals(scope.ownerUserId()))
            throw ApiProblem.forbidden();
        Membership m=memberships.findByUserIdAndClinicIdAndRole(userId,clinicId,MembershipRole.CLINIC_OWNER).orElse(null);
        if(m!=null && m.status==MembershipStatus.ACTIVE && m.allBranches) return view(m);
        if(m==null){
            m=new Membership();m.userId=userId;m.clinicId=clinicId;m.role=MembershipRole.CLINIC_OWNER;
            m.createdBy=userId;m.allBranches=true;m.status=MembershipStatus.ACTIVE;
        }else{
            m.status=MembershipStatus.ACTIVE;m.revokedAt=null;m.revokedBy=null;m.allBranches=true;m.version++;
        }
        memberships.saveAndFlush(m);
        branchGrants.deleteByMembershipId(m.id);
        bump(m.userId);
        audit(actorUserId,workloadSubject,m.userId,m.clinicId,m.id,"OWNER_PROVISIONED",reason);
        return view(m);
    }

    @Transactional
    public PlatformGrantView grantPlatform(String workloadSubject,PlatformGrantInput input) {
        PlatformGrantId id=new PlatformGrantId(input.userId(),input.capability());
        PlatformGrant g=platformGrants.findById(id).orElse(null);
        if(g!=null && g.status==MembershipStatus.ACTIVE) return platformView(g);
        if(g==null){
            g=new PlatformGrant();g.userId=input.userId();g.capability=input.capability();g.grantedBy=workloadSubject;
            g.status=MembershipStatus.ACTIVE;g.version=1;
        }else{
            g.status=MembershipStatus.ACTIVE;g.revokedAt=null;g.version++;g.grantedBy=workloadSubject;
        }
        platformGrants.saveAndFlush(g);bump(g.userId);
        audit(null,workloadSubject,g.userId,null,null,"PLATFORM_GRANT_ENABLED",input.reason());
        return platformView(g);
    }

    @Transactional
    public PlatformGrantView revokePlatform(String workloadSubject,PlatformGrantInput input) {
        PlatformGrant g=platformGrants.findById(new PlatformGrantId(input.userId(),input.capability())).orElseThrow(ApiProblem::missing);
        if(g.status==MembershipStatus.ACTIVE){
            g.status=MembershipStatus.REVOKED;g.revokedAt=Instant.now();g.version++;bump(g.userId);
            audit(null,workloadSubject,g.userId,null,null,"PLATFORM_GRANT_REVOKED",input.reason());
        }
        return platformView(g);
    }

    @Transactional(readOnly=true)
    public AuthorizationResult authorizeInternal(AuthorizationRequest input) {
        long version=epoch(input.userId());
        boolean allowed=switch(input.capability()) {
            case "PLATFORM_CLINIC_REVIEW" ->
                platformGrants.existsByUserIdAndCapabilityAndStatus(input.userId(),PlatformCapability.PLATFORM_CLINIC_REVIEW,MembershipStatus.ACTIVE);
            case "CLINIC_MEMBERSHIP_ADMIN" -> input.clinicId()!=null && hasRole(input.userId(),input.clinicId(),MembershipRole.CLINIC_OWNER);
            case "CLINIC_CONTEXT" -> input.clinicId()!=null && input.branchId()!=null && canUseBranch(input.userId(),input.clinicId(),input.branchId());
            default -> false;
        };
        return new AuthorizationResult(allowed,version);
    }

    @Transactional(readOnly=true)
    public List<PlatformGrantView> myPlatformGrants(Actor actor) {
        return platformGrants.findByUserIdAndStatus(actor.id(),MembershipStatus.ACTIVE).stream().map(this::platformView).toList();
    }

    private boolean canUseBranch(UUID userId,UUID clinicId,UUID branchId) {
        for(Membership m:memberships.activeForContext(userId,clinicId))
            if(m.allBranches || branchGrants.existsByMembershipIdAndBranchId(m.id,branchId)) return true;
        return false;
    }
    private boolean hasRole(UUID userId,UUID clinicId,MembershipRole role) {
        return memberships.activeForContext(userId,clinicId).stream().anyMatch(m->m.role==role);
    }
    private void requireMembershipAdmin(Actor actor,UUID clinicId) {
        if(actor==null || !hasRole(actor.id(),clinicId,MembershipRole.CLINIC_OWNER)) throw ApiProblem.forbidden();
    }
    private void validateScope(UUID clinicId,boolean allBranches,Set<UUID> branchIds) {
        Set<UUID> requested=branchIds==null?Set.of():Set.copyOf(branchIds);
        if(allBranches && !requested.isEmpty()) throw ApiProblem.invalid("allBranches cannot be combined with explicit branchIds");
        if(!allBranches && requested.isEmpty()) throw ApiProblem.invalid("At least one branch grant is required");
        var verified=clinics.clinicScope(clinicId,requested);
        if(verified==null || !verified.exists() || !clinicId.equals(verified.clinicId()) ||
           !verified.validBranchIds().containsAll(requested))
            throw ApiProblem.invalid("Clinic or branch scope is not valid");
    }
    private void requireBranchExists(UUID clinicId,UUID branchId) {
        var verified=clinics.clinicScope(clinicId,Set.of(branchId));
        if(verified==null || !verified.exists() || !verified.validBranchIds().contains(branchId)) throw ApiProblem.forbidden();
    }
    private void replaceBranchGrants(Membership m,Set<UUID> ids) {
        branchGrants.deleteByMembershipId(m.id);
        if(m.allBranches || ids==null) return;
        for(UUID branchId:ids){
            MembershipBranchGrant g=new MembershipBranchGrant();g.membershipId=m.id;g.clinicId=m.clinicId;g.branchId=branchId;
            branchGrants.save(g);
        }
        branchGrants.flush();
    }
    private long epoch(UUID userId) {return epochs.findById(userId).map(e->e.epoch).orElse(0L);}
    private void bump(UUID userId) {
        PermissionEpoch e=epochs.lockByUserId(userId).orElse(null);
        if(e==null){e=new PermissionEpoch();e.userId=userId;e.epoch=1;} else e.epoch++;
        epochs.saveAndFlush(e);
    }
    private MembershipView view(Membership m) {
        Set<UUID> grants=m.allBranches?Set.of():branchGrants.findByMembershipId(m.id).stream().map(g->g.branchId).collect(java.util.stream.Collectors.toUnmodifiableSet());
        return new MembershipView(m.id,m.userId,m.clinicId,m.role,m.status,m.allBranches,grants,m.version,m.revokedAt);
    }
    private PlatformGrantView platformView(PlatformGrant g){
        return new PlatformGrantView(g.userId,g.capability,g.status,g.version,g.revokedAt);
    }
    private void audit(UUID actor,String workload,UUID target,UUID clinic,UUID membership,String action,String reason){
        SecurityEvent e=new SecurityEvent();e.actorUserId=actor;e.workloadSubject=workload;e.targetUserId=target;
        e.clinicId=clinic;e.membershipId=membership;e.action=action;e.reason=reason.trim();events.save(e);
    }
}
