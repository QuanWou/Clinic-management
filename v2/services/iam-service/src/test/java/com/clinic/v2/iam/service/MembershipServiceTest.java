package com.clinic.v2.iam.service;

import com.clinic.v2.iam.api.ApiProblem;
import com.clinic.v2.iam.api.IamDto.*;
import com.clinic.v2.iam.client.ClinicDirectoryClient;
import com.clinic.v2.iam.domain.*;
import com.clinic.v2.iam.repo.*;
import com.clinic.v2.iam.security.Actor;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MembershipServiceTest {
    @Mock MembershipRepository memberships;
    @Mock BranchGrantRepository branchGrants;
    @Mock PlatformGrantRepository platformGrants;
    @Mock PermissionEpochRepository epochs;
    @Mock SecurityEventRepository events;
    @Mock ClinicDirectoryClient clinics;

    final UUID clinicA=UUID.randomUUID(), clinicB=UUID.randomUUID();
    final UUID branchA=UUID.randomUUID(), branchA2=UUID.randomUUID(), branchB=UUID.randomUUID();
    final UUID ownerId=UUID.randomUUID(), staffId=UUID.randomUUID();
    final Actor owner=new Actor(ownerId,Set.of("ROLE_ADMIN"),Instant.now().minusSeconds(1));
    final Actor staff=new Actor(staffId,Set.of("ROLE_DOCTOR"),Instant.now().minusSeconds(1));
    Membership ownerGrant,staffGrant;
    MembershipService service;

    @BeforeEach void setup(){
        service=new MembershipService(memberships,branchGrants,platformGrants,epochs,events,clinics);
        ownerGrant=membership(ownerId,clinicA,MembershipRole.CLINIC_OWNER,true);
        staffGrant=membership(staffId,clinicA,MembershipRole.DOCTOR,false);
        lenient().when(clinics.clinicScope(eq(clinicA),any())).thenReturn(
            new ClinicDirectoryClient.Scope(clinicA,ownerId,true,Set.of(branchA,branchA2)));
        lenient().when(clinics.clinicScope(eq(clinicB),any())).thenReturn(
            new ClinicDirectoryClient.Scope(clinicB,UUID.randomUUID(),true,Set.of(branchB)));
        lenient().when(epochs.findById(any())).thenReturn(Optional.empty());
    }

    @Test void explicitBranchGrantDoesNotLeakToSiblingOrOtherClinic(){
        when(memberships.activeForContext(staffId,clinicA)).thenReturn(List.of(staffGrant));
        when(branchGrants.existsByMembershipIdAndBranchId(staffGrant.id,branchA)).thenReturn(true);
        when(branchGrants.existsByMembershipIdAndBranchId(staffGrant.id,branchA2)).thenReturn(false);
        when(memberships.activeForContext(staffId,clinicB)).thenReturn(List.of());

        assertEquals(Set.of(MembershipRole.DOCTOR),service.resolve(staff,clinicA,branchA).roles());
        assertThrows(ApiProblem.class,()->service.resolve(staff,clinicA,branchA2));
        assertThrows(ApiProblem.class,()->service.resolve(staff,clinicB,branchB));
    }

    @Test void ownerCanGrantOnlyVerifiedBranchInOwnClinic(){
        when(memberships.activeForContext(ownerId,clinicA)).thenReturn(List.of(ownerGrant));
        when(memberships.findByUserIdAndClinicIdAndRole(staffId,clinicA,MembershipRole.RECEPTIONIST)).thenReturn(Optional.empty());
        when(memberships.saveAndFlush(any())).thenAnswer(i->i.getArgument(0));
        when(epochs.lockByUserId(staffId)).thenReturn(Optional.empty());
        when(epochs.saveAndFlush(any())).thenAnswer(i->i.getArgument(0));
        MembershipBranchGrant persisted=new MembershipBranchGrant();persisted.clinicId=clinicA;persisted.branchId=branchA;
        when(branchGrants.findByMembershipId(any())).thenReturn(List.of(persisted));

        MembershipView created=service.create(owner,new MembershipInput(staffId,clinicA,MembershipRole.RECEPTIONIST,false,
            Set.of(branchA),"front desk"));
        assertEquals(MembershipStatus.ACTIVE,created.status());
        assertEquals(Set.of(branchA),created.branchIds());
        verify(branchGrants).save(argThat(g->g.clinicId.equals(clinicA) && g.branchId.equals(branchA)));

        assertThrows(ApiProblem.class,()->service.create(owner,
            new MembershipInput(staffId,clinicB,MembershipRole.RECEPTIONIST,true,Set.of(),"cross tenant")));
    }

    @Test void revokeChangesVersionAndNextContextHasNoActiveGrant(){
        Membership receptionist=membership(staffId,clinicA,MembershipRole.RECEPTIONIST,false);
        long original=receptionist.version;
        when(memberships.lockById(receptionist.id)).thenReturn(Optional.of(receptionist));
        when(memberships.activeForContext(ownerId,clinicA)).thenReturn(List.of(ownerGrant));
        PermissionEpoch epoch=new PermissionEpoch();epoch.userId=staffId;epoch.epoch=4;
        when(epochs.lockByUserId(staffId)).thenReturn(Optional.of(epoch));
        when(epochs.saveAndFlush(any())).thenAnswer(i->i.getArgument(0));

        MembershipView revoked=service.revoke(owner,receptionist.id,new RevokeInput("employment ended"));
        assertEquals(MembershipStatus.REVOKED,revoked.status());
        assertEquals(original+1,revoked.version());
        assertEquals(5,epoch.epoch);
        verify(events).save(argThat(e->e.action.equals("MEMBERSHIP_REVOKED") && e.targetUserId.equals(staffId)));

        when(memberships.activeForContext(staffId,clinicA)).thenReturn(List.of());
        assertThrows(ApiProblem.class,()->service.resolve(staff,clinicA,branchA));
    }

    @Test void platformCapabilityIsNotDerivedFromGlobalRole(){
        UUID globalAdmin=UUID.randomUUID();
        when(platformGrants.existsByUserIdAndCapabilityAndStatus(globalAdmin,PlatformCapability.PLATFORM_CLINIC_REVIEW,MembershipStatus.ACTIVE))
            .thenReturn(false);
        AuthorizationResult result=service.authorizeInternal(new AuthorizationRequest(globalAdmin,null,null,"PLATFORM_CLINIC_REVIEW"));
        assertFalse(result.allowed());
    }

    @Test void allBranchesCannotBeCombinedWithExplicitGrant(){
        when(memberships.activeForContext(ownerId,clinicA)).thenReturn(List.of(ownerGrant));
        assertThrows(ApiProblem.class,()->service.create(owner,
            new MembershipInput(staffId,clinicA,MembershipRole.NURSE,true,Set.of(branchA),"bad scope")));
    }

    private Membership membership(UUID user,UUID clinic,MembershipRole role,boolean all){
        Membership m=new Membership();m.id=UUID.randomUUID();m.userId=user;m.clinicId=clinic;m.role=role;
        m.status=MembershipStatus.ACTIVE;m.allBranches=all;m.version=1;m.createdBy=ownerId;return m;
    }
}
