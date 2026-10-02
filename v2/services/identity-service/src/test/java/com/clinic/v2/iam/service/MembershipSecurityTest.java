package com.clinic.v2.iam.service;

import com.clinic.v2.iam.api.*;
import com.clinic.v2.iam.api.IamDto.*;
import com.clinic.v2.iam.domain.*;
import com.clinic.v2.iam.repo.*;
import com.clinic.v2.iam.security.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MembershipSecurityTest {
    @Mock MembershipRepository memberships;
    @Mock BranchGrantRepository grants;
    @Mock MembershipEventRepository events;
    @Mock PlatformOperatorRepository platformOperators;
    @Mock DatabaseScope scope;
    @Mock ClinicDirectoryClient clinicDirectory;

    MembershipService service;
    UUID user=UUID.randomUUID();
    UUID clinic=UUID.randomUUID();
    UUID branch=UUID.randomUUID();

    @BeforeEach void setup() {
        service=new MembershipService(memberships,grants,events,platformOperators,scope,clinicDirectory);
    }

    Membership active(MembershipRole role, boolean allBranches) {
        Membership m=new Membership();
        m.id=UUID.randomUUID();m.userId=user;m.clinicId=clinic;m.role=role;
        m.status=MembershipStatus.ACTIVE;m.allBranches=allBranches;m.invitedBy=UUID.randomUUID();
        m.activatedAt=Instant.now();m.updatedAt=Instant.now();
        return m;
    }

    @Test void untrustedClinicIdNeverBecomesTenantContextWithoutMembership() {
        when(memberships.findByUserIdAndClinicIdAndStatusOrderByInvitedAt(user,clinic,MembershipStatus.ACTIVE))
            .thenReturn(List.of());

        AuthorizationDecision result=service.authorize(
            new AuthorizationRequest(user,clinic,branch,Capability.RECEPTION));

        assertFalse(result.allowed());
        verify(scope).user(user);
        verify(scope,never()).userAndClinic(any(),any());
    }

    @Test void verifiedBranchGrantSetsTenantContextAfterUserOnlyLookup() {
        Membership manager=active(MembershipRole.CLINIC_MANAGER,false);
        BranchGrant g=new BranchGrant();
        g.id=UUID.randomUUID();g.membershipId=manager.id;g.userId=user;g.clinicId=clinic;
        g.branchId=branch;g.active=true;g.grantedBy=UUID.randomUUID();g.grantedAt=Instant.now();
        when(memberships.findByUserIdAndClinicIdAndStatusOrderByInvitedAt(user,clinic,MembershipStatus.ACTIVE))
            .thenReturn(List.of(manager));
        when(grants.findByMembershipIdAndActiveTrueOrderByBranchId(manager.id)).thenReturn(List.of(g));

        assertTrue(service.authorize(
            new AuthorizationRequest(user,clinic,branch,Capability.RECEPTION)).allowed());

        InOrder order=inOrder(scope);
        order.verify(scope).user(user);
        order.verify(scope).userAndClinic(user,clinic);
    }

    @Test void unauthorizedInviteCannotProbeClinicDirectory() {
        when(memberships.findByUserIdAndClinicIdAndStatusOrderByInvitedAt(user,clinic,MembershipStatus.ACTIVE))
            .thenReturn(List.of());
        Actor actor=new Actor(user,Set.of("ROLE_ADMIN"),Instant.now().minusSeconds(5));

        assertThrows(ApiProblem.class,()->service.invite(actor,clinic,
            new CreateMembership(UUID.randomUUID(),MembershipRole.RECEPTIONIST,false,"invite")));
        verifyNoInteractions(clinicDirectory);
    }

    @Test void ownerBootstrapRequiresClinicOwnerSourceAttestation() {
        UUID creator=UUID.randomUUID();
        when(clinicDirectory.clinicOwnedBy(clinic,creator)).thenReturn(false);

        ApiProblem problem=assertThrows(ApiProblem.class,()->service.bootstrapOwner(clinic,creator));
        assertEquals("FORBIDDEN",problem.code);
        verify(memberships,never()).saveAndFlush(any());
        verify(scope,never()).userAndClinic(any(),any());
    }

    @Test void branchGrantTouchesMembershipSoAuthorizationVersionChangesInDatabase() {
        Membership owner=active(MembershipRole.CLINIC_OWNER,true);
        Membership target=active(MembershipRole.RECEPTIONIST,false);
        target.userId=UUID.randomUUID();
        when(memberships.findByUserIdAndClinicIdAndStatusOrderByInvitedAt(user,clinic,MembershipStatus.ACTIVE))
            .thenReturn(List.of(owner));
        when(clinicDirectory.branchExists(clinic,branch)).thenReturn(true);
        when(memberships.findByIdAndClinicId(target.id,clinic)).thenReturn(Optional.of(target));
        when(grants.findByMembershipIdAndBranchId(target.id,branch)).thenReturn(Optional.empty());

        service.grantBranch(new Actor(user,Set.of("ROLE_ADMIN"),Instant.now()),clinic,target.id,
            new GrantBranch(branch,"branch assignment"));

        verify(grants).saveAndFlush(any(BranchGrant.class));
        verify(memberships).saveAndFlush(target);
        verify(events).save(argThat(e->"BRANCH_GRANTED".equals(e.action)));
    }
}
