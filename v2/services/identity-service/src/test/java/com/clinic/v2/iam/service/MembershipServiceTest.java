package com.clinic.v2.iam.service;

import com.clinic.v2.iam.api.Capability;
import com.clinic.v2.iam.api.IamDto.AuthorizationRequest;
import com.clinic.v2.iam.domain.*;
import com.clinic.v2.iam.repo.*;
import com.clinic.v2.iam.security.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MembershipServiceTest {
    @Mock MembershipRepository memberships;
    @Mock BranchGrantRepository grants;
    @Mock MembershipEventRepository events;
    @Mock PlatformOperatorRepository platformOperators;
    @Mock DatabaseScope scope;
    @Mock ClinicDirectoryClient clinicDirectory;

    MembershipService service;
    UUID user=UUID.randomUUID();
    UUID clinic=UUID.randomUUID();
    UUID branchA=UUID.randomUUID();
    UUID branchB=UUID.randomUUID();

    @BeforeEach
    void setUp(){
        service=new MembershipService(memberships,grants,events,platformOperators,scope,clinicDirectory);
    }

    Membership active(MembershipRole role,boolean allBranches){
        Membership m=new Membership();
        m.id=UUID.randomUUID();m.userId=user;m.clinicId=clinic;m.role=role;
        m.status=MembershipStatus.ACTIVE;m.allBranches=allBranches;m.invitedBy=UUID.randomUUID();
        m.activatedAt=Instant.now();return m;
    }

    @Test
    void branchScopedManagerCannotUseClinicWideConfigWithoutAllBranches(){
        Membership manager=active(MembershipRole.CLINIC_MANAGER,false);
        when(memberships.findByUserIdAndClinicIdAndStatusOrderByInvitedAt(user,clinic,MembershipStatus.ACTIVE))
            .thenReturn(List.of(manager));
        var decision=service.authorize(new AuthorizationRequest(user,clinic,null,Capability.CLINIC_CONFIG));
        assertFalse(decision.allowed());
        assertEquals("NO_ACTIVE_GRANT",decision.reason());
    }

    @Test
    void branchScopedManagerCanOperateOnlyGrantedBranch(){
        Membership manager=active(MembershipRole.CLINIC_MANAGER,false);
        BranchGrant grant=new BranchGrant();
        grant.id=UUID.randomUUID();grant.membershipId=manager.id;grant.userId=user;grant.clinicId=clinic;
        grant.branchId=branchA;grant.active=true;grant.grantedBy=UUID.randomUUID();grant.grantedAt=Instant.now();
        when(memberships.findByUserIdAndClinicIdAndStatusOrderByInvitedAt(user,clinic,MembershipStatus.ACTIVE))
            .thenReturn(List.of(manager));
        when(grants.findByMembershipIdAndActiveTrueOrderByBranchId(manager.id)).thenReturn(List.of(grant));

        assertTrue(service.authorize(new AuthorizationRequest(user,clinic,branchA,Capability.RECEPTION)).allowed());
        assertFalse(service.authorize(new AuthorizationRequest(user,clinic,branchB,Capability.RECEPTION)).allowed());
    }

    @Test
    void revokedMembershipIsNeverSelected(){
        when(memberships.findByUserIdAndClinicIdAndStatusOrderByInvitedAt(user,clinic,MembershipStatus.ACTIVE))
            .thenReturn(List.of());
        assertFalse(service.authorize(new AuthorizationRequest(user,clinic,branchA,Capability.RECEPTION)).allowed());
    }

    @Test
    void platformCapabilityIsSeparateFromClinicMembership(){
        PlatformOperator op=new PlatformOperator();op.userId=user;op.active=true;
        when(platformOperators.findById(user)).thenReturn(Optional.of(op));
        assertTrue(service.authorize(new AuthorizationRequest(user,null,null,Capability.PLATFORM_CLINIC_REVIEW)).allowed());

        when(platformOperators.findById(user)).thenReturn(Optional.empty());
        assertFalse(service.authorize(new AuthorizationRequest(user,null,null,Capability.PLATFORM_CLINIC_REVIEW)).allowed());
    }
}
