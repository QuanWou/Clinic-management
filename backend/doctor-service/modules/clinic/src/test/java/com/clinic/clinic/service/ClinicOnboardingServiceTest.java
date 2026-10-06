package com.clinic.clinic.service;

import com.clinic.clinic.api.ApiProblem;
import com.clinic.clinic.api.ClinicDto.*;
import com.clinic.clinic.domain.*;
import com.clinic.clinic.repo.*;
import com.clinic.clinic.security.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;

import java.time.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ClinicOnboardingServiceTest {
    @Mock ClinicRepository clinics;
    @Mock BranchRepository branches;
    @Mock LicenseRepository licenses;
    @Mock ReviewRepository reviews;
    @Mock IamAuthorizationClient iam;
    @Mock TenantDbContext db;

    UUID clinicId=UUID.randomUUID();
    UUID ownerId=UUID.randomUUID();
    UUID operatorId=UUID.randomUUID();
    UUID outsiderId=UUID.randomUUID();
    Actor owner=new Actor(ownerId,Set.of("ROLE_PATIENT"));
    Actor operator=new Actor(operatorId,Set.of("ROLE_ADMIN"));
    Actor outsider=new Actor(outsiderId,Set.of("ROLE_ADMIN"));
    Clinic clinic;
    ClinicLicense license;
    Branch branch;

    ClinicOnboardingService service(boolean enablePublication){
        return new ClinicOnboardingService(clinics,branches,licenses,reviews,
            new PlatformAccess(iam),iam,db,enablePublication);
    }
    @BeforeEach void fixtures(){
        lenient().when(iam.allowed(operatorId,"PLATFORM_CLINIC_REVIEW",null,null)).thenReturn(true);
        lenient().when(iam.allowed(ownerId,"CLINIC_CONFIG",clinicId,null)).thenReturn(true);
        lenient().when(iam.allowed(ownerId,"CLINIC_MEMBER",clinicId,null)).thenReturn(true);
        clinic=new Clinic();clinic.id=clinicId;clinic.ownerUserId=ownerId;
        clinic.name="General Clinic";clinic.slug="general-clinic";
        clinic.contactName="Clinic manager";clinic.contactEmail="manager@example.test";
        clinic.contactPhone="0900000000";
        license=new ClinicLicense();license.clinicId=clinicId;
        license.licenseNumber="TEST-ONLY";license.issuingAuthority="Test authority";
        license.scopeSummary="Outpatient";license.evidenceRef="private/evidence-key";
        license.validUntil=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusYears(1);
        branch=new Branch();branch.id=UUID.randomUUID();branch.clinicId=clinicId;
        branch.name="Main";branch.address="Synthetic street";branch.openingHours="09:00-17:00";branch.active=true;
    }
    void locked(){
        lenient().when(clinics.lockById(clinicId)).thenReturn(Optional.of(clinic));
    }
    void readView(){
        lenient().when(licenses.findById(clinicId)).thenReturn(Optional.of(license));
        lenient().when(branches.findByClinicIdOrderByCreatedAtAsc(clinicId)).thenReturn(List.of(branch));
        lenient().when(branches.findByClinicIdAndActiveTrueOrderByCreatedAtAsc(clinicId)).thenReturn(List.of(branch));
    }
    void submitted(){
        clinic.reviewStatus=ReviewStatus.SUBMITTED;
        readView();
        locked();
    }
    void approved(){
        clinic.reviewStatus=ReviewStatus.APPROVED;
        clinic.evidenceVerified=true;
        readView();
        locked();
    }
    static void status(HttpStatus expected,ExecutableAction action){
        ApiProblem ex=assertThrows(ApiProblem.class,action::run);
        assertEquals(expected,ex.status);
    }
    interface ExecutableAction{void run();}

    @Test void createIsOwnerBoundAndStartsPrivate(){
        when(clinics.saveAndFlush(any(Clinic.class))).thenAnswer(inv->inv.getArgument(0));
        when(branches.findByClinicIdOrderByCreatedAtAsc(any())).thenReturn(List.of());
        var result=service(false).create(owner,new DraftInput("General Clinic","general-clinic",null,null,null,null,null));
        assertEquals(ownerId,result.ownerUserId());
        assertEquals(ReviewStatus.DRAFT,result.reviewStatus());
        assertEquals(PublicationStatus.UNPUBLISHED,result.publicationStatus());
        verify(reviews).save(argThat(e->e.action.equals("CREATED") && e.actorUserId.equals(ownerId)));
    }
    @Test void ownIndexRecoversDraftWithoutIamAndOrdinaryStaffCannotReadPrivateView(){
        readView();
        when(clinics.findByOwnerUserIdOrderByCreatedAtDesc(ownerId)).thenReturn(List.of(clinic));
        when(iam.contexts(ownerId)).thenReturn(List.of());
        assertEquals(clinicId,service(false).mine(owner).getFirst().id());
        verify(db).ownerIndex(ownerId);

        when(clinics.findByOwnerUserIdOrderByCreatedAtDesc(outsiderId)).thenReturn(List.of());
        when(iam.contexts(outsiderId)).thenReturn(List.of(new IamAuthorizationClient.ContextResult(UUID.randomUUID(),clinicId,"STAFF",true,List.of(),0)));
        assertTrue(service(false).mine(outsider).isEmpty());
        verify(db,never()).tenant(clinicId);
        verify(clinics,never()).findById(clinicId);
    }
    @Test void ownerMembershipRetryUsesServerDerivedOwnerIndex(){
        when(clinics.findById(clinicId)).thenReturn(Optional.of(clinic));

        service(false).requireCreatorForBootstrap(owner,clinicId);

        verify(db).ownerIndex(ownerId);
        verify(db,never()).tenant(any());
    }
    @Test void ownerMembershipRetryCannotUseRequestedClinicAsTenantProof(){
        UUID guessed=UUID.randomUUID();
        when(clinics.findById(guessed)).thenReturn(Optional.empty());

        status(HttpStatus.NOT_FOUND,()->service(false).requireCreatorForBootstrap(owner,guessed));

        verify(db).ownerIndex(ownerId);
        verify(db,never()).tenant(any());
    }
    @Test void nonOwnerCannotReadOrEdit(){
        status(HttpStatus.NOT_FOUND,()->service(false).owned(outsider,clinicId));
        locked();
        status(HttpStatus.NOT_FOUND,()->service(false).update(outsider,clinicId,
            new DraftInput("Different","different",null,null,null,null,null)));
        verify(reviews,never()).save(any());
    }
    @Test void draftWithoutRequiredEvidenceCannotSubmit(){
        locked();
        when(licenses.findById(clinicId)).thenReturn(Optional.empty());
        status(HttpStatus.UNPROCESSABLE_ENTITY,()->service(false).submit(owner,clinicId));
        assertEquals(ReviewStatus.DRAFT,clinic.reviewStatus);
    }
    @Test void completeDraftCanSubmit(){
        locked();readView();
        var result=service(false).submit(owner,clinicId);
        assertEquals(ReviewStatus.SUBMITTED,result.reviewStatus());
        verify(reviews).save(argThat(e->e.action.equals("SUBMITTED")));
    }
    @Test void globalAdminNotPlatformCannotReview(){
        submitted();
        status(HttpStatus.FORBIDDEN,()->service(false).approve(outsider,clinicId,new DecisionInput("checked",true)));
    }
    @Test void operatorCannotApproveOwnClinic(){
        clinic.ownerUserId=operatorId;
        lenient().when(iam.allowed(operatorId,"CLINIC_MEMBER",clinicId,null)).thenReturn(true);
        submitted();
        status(HttpStatus.FORBIDDEN,()->service(false).approve(operator,clinicId,new DecisionInput("checked",true)));
    }
    @Test void platformMustConfirmEvidenceBeforeApprove(){
        submitted();
        status(HttpStatus.UNPROCESSABLE_ENTITY,()->service(false).approve(operator,clinicId,new DecisionInput("checked",false)));
        assertEquals(ReviewStatus.SUBMITTED,clinic.reviewStatus);
    }
    @Test void platformApprovalDoesNotPublish(){
        submitted();
        var result=service(true).approve(operator,clinicId,new DecisionInput("private evidence checked",true));
        assertEquals(ReviewStatus.APPROVED,result.reviewStatus());
        assertTrue(result.evidenceVerified());
        assertEquals(PublicationStatus.UNPUBLISHED,result.publicationStatus());
    }
    @Test void publicationDisabledEvenAfterApproval(){
        approved();
        status(HttpStatus.CONFLICT,()->service(false).publish(operator,clinicId,new ReasonInput("approved listing")));
        assertTrue(service(false).publicList(PageRequest.of(0,10)).isEmpty());
    }
    @Test void publicationCapabilityIsOnlyAvailableToCanonicalPlatformOperators(){
        status(HttpStatus.FORBIDDEN,()->service(true).platformCapabilities(outsider));
        assertFalse(service(false).platformCapabilities(operator).publicationEnabled());
        assertTrue(service(true).platformCapabilities(operator).publicationEnabled());
        verify(db,never()).platform();
    }
    @Test void publishRequiresApprovedStatusAndEvidence(){
        submitted();
        status(HttpStatus.CONFLICT,()->service(true).publish(operator,clinicId,new ReasonInput("publish")));
    }
    @Test void approvedClinicCanPublishAndPublicViewIsMinimal() throws Exception {
        approved();
        var result=service(true).publish(operator,clinicId,new ReasonInput("release allowed"));
        assertEquals(PublicationStatus.PUBLISHED,result.publicationStatus());
        assertNotNull(result.publishedAt());
        when(clinics.findBySlug(clinic.slug)).thenReturn(Optional.of(clinic));
        PublicView publicView=service(true).publicBySlug(clinic.slug);
        assertEquals("general-clinic",publicView.slug());
        String json=new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().writeValueAsString(publicView);
        assertFalse(json.contains("licenseNumber"));
        assertFalse(json.contains("evidenceRef"));
        assertFalse(json.contains("contactEmail"));
        verify(reviews).save(argThat(e->e.action.equals("PUBLISHED") && e.actorUserId.equals(operatorId)));
    }
    @Test void suspendedClinicCannotAppearOrAcceptBooking(){
        approved();
        clinic.publicationStatus=PublicationStatus.PUBLISHED;clinic.publishedAt=Instant.now();
        service(true).suspend(operator,clinicId,new ReasonInput("safety review"));
        assertEquals(PublicationStatus.SUSPENDED,clinic.publicationStatus);
        when(clinics.findBySlug(clinic.slug)).thenReturn(Optional.of(clinic));
        status(HttpStatus.NOT_FOUND,()->service(true).publicBySlug(clinic.slug));
        when(clinics.findById(clinicId)).thenReturn(Optional.of(clinic));
        when(branches.findByIdAndClinicId(branch.id,clinicId)).thenReturn(Optional.of(branch));
        assertFalse(service(true).bookingEligibility(clinicId,branch.id).eligible());
    }
    @Test void staleLicenseDisablesExistingPublicClinic(){
        approved();
        clinic.publicationStatus=PublicationStatus.PUBLISHED;clinic.publishedAt=Instant.now();
        license.validUntil=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).minusDays(1);
        when(clinics.findBySlug(clinic.slug)).thenReturn(Optional.of(clinic));
        status(HttpStatus.NOT_FOUND,()->service(true).publicBySlug(clinic.slug));
    }
    @Test void editApprovedUnpublishedInvalidatesPriorApproval(){
        approved();
        var result=service(true).update(owner,clinicId,
            new DraftInput("Changed Name","general-clinic",null,"New contact","clinic@example.test","0901111111",null));
        assertEquals(ReviewStatus.DRAFT,result.reviewStatus());
        assertFalse(result.evidenceVerified());
        assertNull(result.reviewedBy());
    }
    @Test void branchScopedManagerCanUpdateOnlyAuthorizedBranch(){
        locked();readView();
        when(iam.allowed(ownerId,"CLINIC_CONFIG",clinicId,branch.id)).thenReturn(true);
        when(branches.findByIdAndClinicId(branch.id,clinicId)).thenReturn(Optional.of(branch));
        when(branches.saveAndFlush(branch)).thenReturn(branch);

        var result=service(false).updateBranch(owner,clinicId,branch.id,
            new BranchInput("Main Updated","Synthetic street 2","08:00-18:00",true));

        assertEquals("Main Updated",result.branches().get(0).name());
        verify(iam).allowed(ownerId,"CLINIC_CONFIG",clinicId,branch.id);
        verify(db).tenant(clinicId);
    }
    @Test void branchUpdateDeniedBeforeTenantContextWhenGrantMissing(){
        UUID deniedBranch=UUID.randomUUID();
        when(iam.allowed(ownerId,"CLINIC_CONFIG",clinicId,deniedBranch)).thenReturn(false);

        status(HttpStatus.NOT_FOUND,()->service(false).updateBranch(owner,clinicId,deniedBranch,
            new BranchInput("Denied","Synthetic street 3","08:00-18:00",true)));

        verify(db,never()).tenant(any());
        verify(branches,never()).findByIdAndClinicId(any(),any());
    }
    @Test void cannotMutatePublishedRecord(){
        approved();clinic.publicationStatus=PublicationStatus.PUBLISHED;
        status(HttpStatus.CONFLICT,()->service(true).addBranch(owner,clinicId,
            new BranchInput("Branch B","Street B","09:00-16:00",true)));
        verify(branches,never()).saveAndFlush(any());
    }
    @Test void requestChangesKeepsReasonAndDoesNotAutoApprove(){
        submitted();
        var result=service(false).needsChanges(operator,clinicId,new ReasonInput("missing supporting evidence"));
        assertEquals(ReviewStatus.NEEDS_CHANGES,result.reviewStatus());
        verify(reviews).save(argThat(e->e.action.equals("NEEDS_CHANGES") && e.reason.contains("missing")));
    }
}
