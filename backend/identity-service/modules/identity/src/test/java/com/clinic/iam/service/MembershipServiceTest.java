package com.clinic.iam.service;

import com.clinic.iam.api.Capability;
import com.clinic.iam.api.IamDto.AuthorizationRequest;
import com.clinic.iam.domain.*;
import com.clinic.iam.repo.*;
import com.clinic.iam.security.*;
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
        Membership manager=active(MembershipRole.ADMIN,false);
        when(memberships.findByUserIdAndClinicIdAndStatusOrderByInvitedAt(user,clinic,MembershipStatus.ACTIVE))
            .thenReturn(List.of(manager));
        var decision=service.authorize(new AuthorizationRequest(user,clinic,null,Capability.CLINIC_CONFIG));
        assertFalse(decision.allowed());
        assertEquals("NO_ACTIVE_GRANT",decision.reason());
    }

    @Test
    void branchScopedManagerCanOperateOnlyGrantedBranch(){
        Membership manager=active(MembershipRole.ADMIN,false);
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

    @Test void staffCanReceiveAndCollectButCannotWorkOnClinicalRecords(){
        Membership staff=active(MembershipRole.STAFF,true);
        when(memberships.findByUserIdAndClinicIdAndStatusOrderByInvitedAt(user,clinic,MembershipStatus.ACTIVE)).thenReturn(List.of(staff));
        assertTrue(service.authorize(new AuthorizationRequest(user,clinic,branchA,Capability.RECEPTION)).allowed());
        assertTrue(service.authorize(new AuthorizationRequest(user,clinic,branchA,Capability.BILLING)).allowed());
        assertFalse(service.authorize(new AuthorizationRequest(user,clinic,branchA,Capability.DOCTOR_WORK)).allowed());
        assertFalse(service.authorize(new AuthorizationRequest(user,clinic,branchA,Capability.MEMBERSHIP_MANAGE)).allowed());
    }

    @Test void branchScopedStaffCanUseReceptionAtAnyRealBranchWithoutWideningBilling(){
        Membership staff=active(MembershipRole.STAFF,false);
        when(memberships.findByUserIdAndClinicIdAndStatusOrderByInvitedAt(user,clinic,MembershipStatus.ACTIVE)).thenReturn(List.of(staff));
        when(clinicDirectory.branchExists(clinic,branchB)).thenReturn(true);
        assertTrue(service.authorize(new AuthorizationRequest(user,clinic,branchB,Capability.RECEPTION)).allowed());
        assertFalse(service.authorize(new AuthorizationRequest(user,clinic,branchB,Capability.BILLING)).allowed());
        assertFalse(service.authorize(new AuthorizationRequest(user,clinic,branchB,Capability.DOCTOR_WORK)).allowed());
        assertFalse(service.authorize(new AuthorizationRequest(user,clinic,UUID.randomUUID(),Capability.RECEPTION)).allowed());
    }

    @Test void doctorCanRecordResultsButCannotCollectMoneyOrManageStaff(){
        Membership doctor=active(MembershipRole.DOCTOR,true);
        when(memberships.findByUserIdAndClinicIdAndStatusOrderByInvitedAt(user,clinic,MembershipStatus.ACTIVE)).thenReturn(List.of(doctor));
        assertTrue(service.authorize(new AuthorizationRequest(user,clinic,branchA,Capability.DOCTOR_WORK)).allowed());
        assertTrue(service.authorize(new AuthorizationRequest(user,clinic,branchA,Capability.LAB_WORK)).allowed());
        assertFalse(service.authorize(new AuthorizationRequest(user,clinic,branchA,Capability.BILLING)).allowed());
        assertFalse(service.authorize(new AuthorizationRequest(user,clinic,branchA,Capability.MEMBERSHIP_MANAGE)).allowed());
    }

    @Test void administratorDoesNotAcquireClinicalDoctorPermissions(){
        Membership admin=active(MembershipRole.ADMIN,true);
        when(memberships.findByUserIdAndClinicIdAndStatusOrderByInvitedAt(user,clinic,MembershipStatus.ACTIVE)).thenReturn(List.of(admin));
        assertTrue(service.authorize(new AuthorizationRequest(user,clinic,branchA,Capability.BILLING)).allowed());
        assertFalse(service.authorize(new AuthorizationRequest(user,clinic,branchA,Capability.DOCTOR_WORK)).allowed());
        assertFalse(service.authorize(new AuthorizationRequest(user,clinic,branchA,Capability.LAB_WORK)).allowed());
    }

    @Test
    void platformCapabilityIsSeparateFromClinicMembership(){
        PlatformOperator op=new PlatformOperator();op.userId=user;op.active=true;
        when(platformOperators.findById(user)).thenReturn(Optional.of(op));
        assertTrue(service.authorize(new AuthorizationRequest(user,null,null,Capability.PLATFORM_CLINIC_REVIEW)).allowed());

        when(platformOperators.findById(user)).thenReturn(Optional.empty());
        assertFalse(service.authorize(new AuthorizationRequest(user,null,null,Capability.PLATFORM_CLINIC_REVIEW)).allowed());
    }

    @Test void staffCannotDirectlyProvisionStaff(){
        when(memberships.findByUserIdAndClinicIdAndStatusOrderByInvitedAt(user,clinic,MembershipStatus.ACTIVE)).thenReturn(List.of(active(MembershipRole.STAFF,true)));
        assertThrows(com.clinic.iam.api.ApiProblem.class,()->service.addStaff(new Actor(user,Set.of(),Instant.now()),clinic,
            new com.clinic.iam.api.IamDto.CreateMembership(UUID.randomUUID(),MembershipRole.ADMIN,true,null)));
        verify(memberships,never()).saveAndFlush(any());
    }

    @Test void adminAddsAnActiveStaffMemberWithoutAnInvitation(){
        when(memberships.findByUserIdAndClinicIdAndStatusOrderByInvitedAt(user,clinic,MembershipStatus.ACTIVE)).thenReturn(List.of(active(MembershipRole.ADMIN,true)));
        when(clinicDirectory.clinicExists(clinic)).thenReturn(true);
        when(memberships.saveAndFlush(any())).thenAnswer(call->{Membership m=call.getArgument(0);m.id=UUID.randomUUID();return m;});
        var target=UUID.randomUUID();
        var result=service.addStaff(new Actor(user,Set.of(),Instant.now()),clinic,
            new com.clinic.iam.api.IamDto.CreateMembership(target,MembershipRole.DOCTOR,true,null));
        assertEquals(target,result.userId()); assertEquals(MembershipStatus.ACTIVE,result.status());
        assertTrue(result.allBranches()); assertNotNull(result.activatedAt());
    }

    @Test void staleRoleEditAndOwnerEditAreRejected(){
        when(memberships.findByUserIdAndClinicIdAndStatusOrderByInvitedAt(user,clinic,MembershipStatus.ACTIVE)).thenReturn(List.of(active(MembershipRole.ADMIN,true)));
        Membership target=active(MembershipRole.STAFF,true);target.userId=UUID.randomUUID();target.version=4;
        when(memberships.lockById(target.id)).thenReturn(Optional.of(target));
        var actor=new Actor(user,Set.of(),Instant.now());
        assertThrows(com.clinic.iam.api.ApiProblem.class,()->service.updateStaffRole(actor,clinic,target.id,
            new com.clinic.iam.api.IamDto.UpdateStaffRole(MembershipRole.DOCTOR,3)));
        target.clinicOwner=true;
        assertThrows(com.clinic.iam.api.ApiProblem.class,()->service.updateStaffRole(actor,clinic,target.id,
            new com.clinic.iam.api.IamDto.UpdateStaffRole(MembershipRole.DOCTOR,4)));
        verify(memberships,never()).saveAndFlush(any());
    }

    @Test void roleEditIsScopedToTheAuthorizedClinic(){
        when(memberships.findByUserIdAndClinicIdAndStatusOrderByInvitedAt(user,clinic,MembershipStatus.ACTIVE)).thenReturn(List.of(active(MembershipRole.ADMIN,true)));
        Membership target=active(MembershipRole.STAFF,true);target.userId=UUID.randomUUID();target.clinicId=UUID.randomUUID();
        when(memberships.lockById(target.id)).thenReturn(Optional.of(target));
        assertThrows(com.clinic.iam.api.ApiProblem.class,()->service.updateStaffRole(new Actor(user,Set.of(),Instant.now()),clinic,target.id,
            new com.clinic.iam.api.IamDto.UpdateStaffRole(MembershipRole.DOCTOR,0)));
        verify(memberships,never()).saveAndFlush(any());
    }
}
