package com.clinic.clinic.service;

import com.clinic.clinic.api.ApiProblem;
import com.clinic.clinic.api.ClinicDto.*;
import com.clinic.clinic.domain.*;
import com.clinic.clinic.repo.*;
import com.clinic.clinic.security.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.*;

@Service
public class ClinicOnboardingService {
    private static final ZoneId CLINIC_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ClinicRepository clinics;
    private final BranchRepository branches;
    private final LicenseRepository licenses;
    private final ReviewRepository reviews;
    private final PlatformAccess platform;
    private final IamAuthorizationClient iam;
    private final TenantDbContext db;
    private final boolean publicationEnabled;

    public ClinicOnboardingService(ClinicRepository clinics, BranchRepository branches,
            LicenseRepository licenses, ReviewRepository reviews, PlatformAccess platform,
            IamAuthorizationClient iam, TenantDbContext db,
            @Value("${clinic.publication.enabled:false}") boolean publicationEnabled) {
        this.clinics=clinics; this.branches=branches; this.licenses=licenses;
        this.reviews=reviews; this.platform=platform; this.iam=iam; this.db=db;
        this.publicationEnabled=publicationEnabled;
    }

    @Transactional
    public OwnerView create(Actor actor, DraftInput input) {
        Clinic c=new Clinic();
        c.id=UUID.randomUUID();
        c.ownerUserId=actor.id();
        db.tenant(c.id);
        apply(c,input);
        clinics.saveAndFlush(c);
        if(input.license()!=null) putLicense(c.id,input.license());
        audit(c,actor,"CREATED","Clinic draft created");
        return ownerView(c);
    }

    @Transactional(readOnly=true)
    public List<OwnerView> mine(Actor actor) {
        if(actor==null) throw ApiProblem.missing();
        // Creator recovery is independent of an incomplete IAM bootstrap. Staff
        // contexts must never reveal the private owner/contact/license view.
        db.ownerIndex(actor.id());
        LinkedHashMap<UUID,OwnerView> visible=new LinkedHashMap<>();
        for(Clinic created:clinics.findByOwnerUserIdOrderByCreatedAtDesc(actor.id()))
            visible.put(created.id,ownerView(created));
        LinkedHashSet<UUID> clinicIds = new LinkedHashSet<>();
        for (IamAuthorizationClient.ContextResult context : iam.contexts(actor.id())) {
            if(context.allBranches() && Set.of("ADMIN").contains(context.role())
                && iam.allowed(actor.id(),"CLINIC_CONFIG",context.clinicId(),null))
                clinicIds.add(context.clinicId());
        }
        for (UUID clinicId : clinicIds) {
            db.tenant(clinicId);
            clinics.findById(clinicId).ifPresent(c -> visible.put(c.id,ownerView(c)));
        }
        return List.copyOf(visible.values());
    }

    @Transactional(readOnly=true)
    public OwnerView owned(Actor actor,UUID id) {
        requireReadContext(actor,id);
        Clinic c=clinics.findById(id).orElseThrow(ApiProblem::missing);
        return ownerView(c);
    }

    @Transactional(readOnly=true)
    public void requireCreatorForBootstrap(Actor actor,UUID id) {
        if(actor==null) throw ApiProblem.missing();
        // Resolve through a server-derived owner index. The path clinic UUID is
        // only a lookup key and never becomes tenant context before ownership
        // is proven.
        db.ownerIndex(actor.id());
        Clinic c=clinics.findById(id).orElseThrow(ApiProblem::missing);
        if(!actor.id().equals(c.ownerUserId)) throw ApiProblem.missing();
    }

    @Transactional
    public OwnerView update(Actor actor,UUID id,DraftInput input) {
        requireClinicAdminContext(actor,id);
        Clinic c=locked(id);
        requireVersion(c,input.expectedVersion());
        assertEditable(c);
        apply(c,input);
        if(input.license()!=null) putLicense(c.id,input.license());
        invalidateApproval(c);
        audit(c,actor,"DRAFT_UPDATED","Clinic profile updated; previous review invalidated");
        persistConfiguration(c);
        return ownerView(c);
    }

    @Transactional
    public OwnerView addBranch(Actor actor,UUID clinicId,BranchInput input) {
        requireClinicAdminContext(actor,clinicId);
        Clinic c=locked(clinicId);
        requireVersion(c,input.expectedVersion());
        assertEditable(c);
        Branch b=new Branch();
        b.clinicId=c.id;
        apply(b,input);
        branches.saveAndFlush(b);
        invalidateApproval(c);
        audit(c,actor,"BRANCH_ADDED","Branch created");
        persistConfiguration(c);
        return ownerView(c);
    }

    @Transactional
    public OwnerView updateBranch(Actor actor,UUID clinicId,UUID branchId,BranchInput input) {
        requireClinicAdminContext(actor,clinicId,branchId);
        Clinic c=locked(clinicId);
        requireVersion(c,input.expectedVersion());
        assertEditable(c);
        Branch b=branches.findByIdAndClinicId(branchId,c.id).orElseThrow(ApiProblem::missing);
        apply(b,input);
        branches.saveAndFlush(b);
        invalidateApproval(c);
        audit(c,actor,"BRANCH_UPDATED","Branch profile changed");
        persistConfiguration(c);
        return ownerView(c);
    }

    @Transactional
    public OwnerView submit(Actor actor,UUID id) {
        requireClinicAdminContext(actor,id);
        Clinic c=locked(id);
        if(c.reviewStatus!=ReviewStatus.DRAFT && c.reviewStatus!=ReviewStatus.NEEDS_CHANGES)
            throw ApiProblem.conflict("Only a draft or needs-changes profile may be submitted");
        requireReady(c);
        c.reviewStatus=ReviewStatus.SUBMITTED;
        c.evidenceVerified=false;
        c.reviewedBy=null; c.reviewedAt=null;
        audit(c,actor,"SUBMITTED","Submitted for separate platform review");
        return ownerView(c);
    }

    @Transactional
    public OwnerView needsChanges(Actor actor,UUID id,ReasonInput input) {
        Clinic c=reviewable(actor,id);
        if(c.reviewStatus!=ReviewStatus.SUBMITTED) throw ApiProblem.conflict("Only submitted profiles may be reviewed");
        c.reviewStatus=ReviewStatus.NEEDS_CHANGES;
        c.evidenceVerified=false;
        c.reviewedBy=actor.id(); c.reviewedAt=Instant.now();
        audit(c,actor,"NEEDS_CHANGES",input.reason().trim());
        return ownerView(c);
    }

    @Transactional
    public OwnerView reject(Actor actor,UUID id,ReasonInput input) {
        Clinic c=reviewable(actor,id);
        if(c.reviewStatus!=ReviewStatus.SUBMITTED) throw ApiProblem.conflict("Only submitted profiles may be rejected");
        c.reviewStatus=ReviewStatus.REJECTED;
        c.evidenceVerified=false;
        c.reviewedBy=actor.id(); c.reviewedAt=Instant.now();
        audit(c,actor,"REJECTED",input.reason().trim());
        return ownerView(c);
    }

    @Transactional
    public OwnerView approve(Actor actor,UUID id,DecisionInput input) {
        Clinic c=reviewable(actor,id);
        if(c.reviewStatus!=ReviewStatus.SUBMITTED) throw ApiProblem.conflict("Only submitted profiles may be approved");
        if(!input.evidenceVerified()) throw ApiProblem.invalid("Platform reviewer must explicitly verify private license evidence");
        requireReady(c);
        c.reviewStatus=ReviewStatus.APPROVED;
        c.evidenceVerified=true;
        c.reviewedBy=actor.id(); c.reviewedAt=Instant.now();
        audit(c,actor,"APPROVED",input.reason().trim());
        return ownerView(c);
    }

    @Transactional
    public OwnerView publish(Actor actor,UUID id,ReasonInput input) {
        Clinic c=reviewable(actor,id);
        if(!publicationEnabled) throw ApiProblem.conflict("Publication disabled pending OD-11 legal/platform approval");
        if(c.publicationStatus!=PublicationStatus.UNPUBLISHED || c.reviewStatus!=ReviewStatus.APPROVED || !c.evidenceVerified)
            throw ApiProblem.conflict("Clinic must have verified approval and be unpublished");
        requireReady(c);
        c.publicationStatus=PublicationStatus.PUBLISHED;
        c.publishedAt=Instant.now();
        audit(c,actor,"PUBLISHED",input.reason().trim());
        return ownerView(c);
    }

    @Transactional
    public OwnerView unpublish(Actor actor,UUID id,ReasonInput input) {
        Clinic c=reviewable(actor,id);
        if(c.publicationStatus==PublicationStatus.UNPUBLISHED)
            throw ApiProblem.conflict("Clinic is already unpublished");
        c.publicationStatus=PublicationStatus.UNPUBLISHED;
        audit(c,actor,"UNPUBLISHED",input.reason().trim());
        return ownerView(c);
    }

    @Transactional
    public OwnerView suspend(Actor actor,UUID id,ReasonInput input) {
        Clinic c=reviewable(actor,id);
        if(c.publicationStatus!=PublicationStatus.PUBLISHED)
            throw ApiProblem.conflict("Only published clinics may be suspended");
        c.publicationStatus=PublicationStatus.SUSPENDED;
        audit(c,actor,"SUSPENDED",input.reason().trim());
        return ownerView(c);
    }

    @Transactional(readOnly=true)
    public Page<OwnerView> submissions(Actor actor,ReviewStatus status,Pageable page) {
        requirePlatform(actor);
        db.platform();
        return clinics.findByReviewStatusOrderByCreatedAtAsc(status,page).map(this::ownerView);
    }
    public record PlatformCapabilities(boolean publicationEnabled){}
    public PlatformCapabilities platformCapabilities(Actor actor) {
        requirePlatform(actor);
        return new PlatformCapabilities(publicationEnabled);
    }

    @Transactional(readOnly=true)
    public List<ReviewView> history(Actor actor,UUID id) {
        requireReadContext(actor,id);
        Clinic c=clinics.findById(id).orElseThrow(ApiProblem::missing);
        return reviews.findByClinicIdOrderByOccurredAtAsc(id).stream()
            .map(r->new ReviewView(r.id,r.actorUserId,r.action,r.reason,r.occurredAt)).toList();
    }

    @Transactional(readOnly=true)
    public Page<PublicView> publicList(Pageable pageable) {
        if(!publicationEnabled) return Page.empty(pageable);
        db.publicRead();
        return clinics.findPublicEligible(LocalDate.now(CLINIC_ZONE),pageable).map(this::publicView);
    }

    @Transactional(readOnly=true)
    public PublicView publicBySlug(String slug) {
        if(!publicationEnabled) throw ApiProblem.missing();
        db.publicRead();
        Clinic c=clinics.findBySlug(slug).orElseThrow(ApiProblem::missing);
        if(!eligible(c,null)) throw ApiProblem.missing();
        return publicView(c);
    }

    @Transactional(readOnly=true)
    public PublicView publicById(UUID id) {
        if(!publicationEnabled)throw ApiProblem.missing();db.publicRead();
        Clinic c=clinics.findById(id).orElseThrow(ApiProblem::missing);
        if(!eligible(c,null))throw ApiProblem.missing();return publicView(c);
    }

    // Intended for a separately authenticated S1 command owner. No client-provided clinic ID grants a permission.
    @Transactional(readOnly=true)
    public BookingEligibility bookingEligibility(UUID clinicId,UUID branchId) {
        if(!publicationEnabled) return new BookingEligibility(clinicId,false,0);
        db.system();
        Clinic c=clinics.findById(clinicId).orElseThrow(ApiProblem::missing);
        Branch branch=branches.findByIdAndClinicId(branchId,c.id).orElseThrow(ApiProblem::missing);
        return new BookingEligibility(c.id,eligible(c,branch),c.version);
    }

    @Transactional(readOnly=true)
    public ScopeValidation scopeValidation(UUID clinicId,Set<UUID> requestedBranchIds) {
        db.system();
        Clinic c=clinics.findById(clinicId).orElseThrow(ApiProblem::missing);
        Set<UUID> valid=new LinkedHashSet<>();
        Set<UUID> requested=requestedBranchIds==null?Set.of():requestedBranchIds;
        if(!requested.isEmpty()) {
            for(Branch b:branches.findByClinicIdOrderByCreatedAtAsc(clinicId))
                if(requested.contains(b.id)) valid.add(b.id);
        }
        return new ScopeValidation(c.id,c.ownerUserId,true,Set.copyOf(valid));
    }

    public record ReceptionDirectory(UUID id,String name,List<BranchView> branches){}
    @Transactional(readOnly=true)
    public ReceptionDirectory billingDirectory(Actor actor,UUID clinicId){
        if(actor==null)throw ApiProblem.forbidden();db.tenant(clinicId);
        Clinic clinic=clinics.findById(clinicId).orElseThrow(ApiProblem::missing);
        var visible=branches.findByClinicIdAndActiveTrueOrderByCreatedAtAsc(clinicId).stream()
            .filter(b->iam.allowed(actor.id(),"BILLING",clinicId,b.id)).map(this::branchView).toList();
        if(visible.isEmpty())throw ApiProblem.forbidden();return new ReceptionDirectory(clinicId,clinic.name,visible);
    }
    @Transactional(readOnly=true)
    public ReceptionDirectory labDirectory(Actor actor,UUID clinicId){
        if(actor==null)throw ApiProblem.forbidden();db.tenant(clinicId);
        Clinic clinic=clinics.findById(clinicId).orElseThrow(ApiProblem::missing);
        var visible=branches.findByClinicIdAndActiveTrueOrderByCreatedAtAsc(clinicId).stream()
            .filter(b->iam.allowed(actor.id(),"LAB_WORK",clinicId,b.id)).map(this::branchView).toList();
        if(visible.isEmpty())throw ApiProblem.forbidden();return new ReceptionDirectory(clinicId,clinic.name,visible);
    }
    @Transactional(readOnly=true)
    public ReceptionDirectory careDirectory(Actor actor,UUID clinicId){
        if(actor==null)throw ApiProblem.forbidden();db.tenant(clinicId);
        Clinic clinic=clinics.findById(clinicId).orElseThrow(ApiProblem::missing);
        var visible=branches.findByClinicIdAndActiveTrueOrderByCreatedAtAsc(clinicId).stream()
            .filter(b->iam.allowed(actor.id(),"DOCTOR_WORK",clinicId,b.id)).map(this::branchView).toList();
        if(visible.isEmpty())throw ApiProblem.forbidden();return new ReceptionDirectory(clinicId,clinic.name,visible);
    }
    @Transactional(readOnly=true)
    public ReceptionDirectory receptionDirectory(Actor actor,UUID clinicId){
        if(actor==null)throw ApiProblem.forbidden();db.tenant(clinicId);
        Clinic clinic=clinics.findById(clinicId).orElseThrow(ApiProblem::missing);
        var visible=branches.findByClinicIdAndActiveTrueOrderByCreatedAtAsc(clinicId).stream()
            .filter(b->iam.allowed(actor.id(),"RECEPTION",clinicId,b.id)).map(this::branchView).toList();
        if(visible.isEmpty())throw ApiProblem.forbidden();return new ReceptionDirectory(clinicId,clinic.name,visible);
    }
    private boolean eligible(Clinic c,Branch branch) {
        if(c.reviewStatus!=ReviewStatus.APPROVED || !c.evidenceVerified ||
            c.publicationStatus!=PublicationStatus.PUBLISHED || c.publishedAt==null) return false;
        var l=licenses.findById(c.id).orElse(null);
        if(l==null || l.validUntil==null || l.validUntil.isBefore(LocalDate.now(CLINIC_ZONE))) return false;
        if(branch!=null) return branch.active;
        return branches.findByClinicIdAndActiveTrueOrderByCreatedAtAsc(c.id).stream().findAny().isPresent();
    }

    private PublicView publicView(Clinic c) {
        List<BranchView> publicBranches=branches.findByClinicIdAndActiveTrueOrderByCreatedAtAsc(c.id)
            .stream().map(this::branchView).toList();
        return new PublicView(c.id,c.slug,c.name,c.publicDescription,c.publishedAt,publicBranches,c.contactPhone);
    }

    private OwnerView ownerView(Clinic c) {
        ClinicLicense l=licenses.findById(c.id).orElse(null);
        LicensePrivate privateLicense=l==null?null:
            new LicensePrivate(l.licenseNumber,l.issuingAuthority,l.scopeSummary,l.evidenceRef,l.validUntil);
        return new OwnerView(c.id,c.ownerUserId,c.slug,c.name,c.publicDescription,
            c.contactName,c.contactEmail,c.contactPhone,c.reviewStatus,c.publicationStatus,
            c.evidenceVerified,c.reviewedBy,c.reviewedAt,c.publishedAt,c.version,privateLicense,
            branches.findByClinicIdOrderByCreatedAtAsc(c.id).stream().map(this::branchView).toList());
    }

    private BranchView branchView(Branch b) {
        return new BranchView(b.id,b.name,b.address,b.openingHours,b.active);
    }
    private void apply(Clinic c,DraftInput i) {
        c.name=i.name().trim(); c.slug=i.slug().trim(); c.publicDescription=trim(i.publicDescription());
        c.contactName=trim(i.contactName());c.contactEmail=trim(i.contactEmail());
        c.contactPhone=trim(i.contactPhone());
    }
    private void apply(Branch b,BranchInput i){
        b.name=i.name().trim(); b.address=i.address().trim();
        b.openingHours=i.openingHours().trim(); b.active=i.active();
    }
    private String trim(String value){return value==null?null:value.trim();}
    private void putLicense(UUID id,LicenseInput i) {
        ClinicLicense l=licenses.findById(id).orElseGet(()->{ClinicLicense v=new ClinicLicense();v.clinicId=id;return v;});
        l.licenseNumber=trim(i.licenseNumber()); l.issuingAuthority=trim(i.issuingAuthority());
        l.scopeSummary=trim(i.scopeSummary());l.evidenceRef=trim(i.evidenceRef());
        l.validUntil=i.validUntil();
        licenses.save(l);
    }
    private void requireReady(Clinic c) {
        ClinicLicense l=licenses.findById(c.id).orElse(null);
        if(c.name==null || c.name.isBlank() || c.contactName==null || c.contactName.isBlank() ||
            c.contactEmail==null || c.contactEmail.isBlank() || c.contactPhone==null || c.contactPhone.isBlank() ||
            l==null || blank(l.licenseNumber) || blank(l.issuingAuthority) || blank(l.scopeSummary) ||
            blank(l.evidenceRef) || l.validUntil==null || l.validUntil.isBefore(LocalDate.now(CLINIC_ZONE)) ||
            branches.findByClinicIdAndActiveTrueOrderByCreatedAtAsc(c.id).isEmpty())
            throw ApiProblem.invalid("Clinic contact, current license evidence and active branch are required");
    }
    private boolean blank(String s){return s==null || s.isBlank();}
    private void invalidateApproval(Clinic c) {
        c.reviewStatus=ReviewStatus.DRAFT;
        c.evidenceVerified=false;
        c.reviewedBy=null;c.reviewedAt=null;
    }
    private void assertEditable(Clinic c) {
        if(c.publicationStatus!=PublicationStatus.UNPUBLISHED ||
            (c.reviewStatus!=ReviewStatus.DRAFT && c.reviewStatus!=ReviewStatus.NEEDS_CHANGES &&
             c.reviewStatus!=ReviewStatus.APPROVED))
            throw ApiProblem.conflict("Clinic must be unpublished and not awaiting review to edit");
    }
    private Clinic locked(UUID id) {return clinics.lockById(id).orElseThrow(ApiProblem::missing);}
    private void requireVersion(Clinic c,Long expected) {
        if(expected!=null && expected.longValue()!=c.version)
            throw ApiProblem.conflict("Clinic version changed; reload the source before editing");
    }
    private void persistConfiguration(Clinic c) {
        c.updatedAt=Instant.now(); // branch-only edits also invalidate stale clinic forms
        clinics.saveAndFlush(c);
    }
    private void requirePlatform(Actor actor) {
        if(!platform.allowed(actor)) throw ApiProblem.forbidden();
    }
    private void requireClinicAdminContext(Actor actor,UUID clinicId) {
        if(actor==null || !iam.allowed(actor.id(),"CLINIC_CONFIG",clinicId,null)) throw ApiProblem.missing();
        db.tenant(clinicId); // set only after IAM resolves an active clinic membership
    }
    private void requireClinicAdminContext(Actor actor,UUID clinicId,UUID branchId) {
        if(actor==null || !iam.allowed(actor.id(),"CLINIC_CONFIG",clinicId,branchId)) throw ApiProblem.missing();
        db.tenant(clinicId); // set only after IAM resolves the requested branch grant
    }
    private void requireReadContext(Actor actor,UUID clinicId) {
        if(actor!=null && platform.allowed(actor)) { db.platform(); return; }
        requireClinicAdminContext(actor,clinicId);
    }
    private Clinic reviewable(Actor actor,UUID id) {
        requirePlatform(actor);
        // Platform moderation is separate from a tenant role. A platform operator who is also a clinic owner cannot self-review.
        if(iam.allowed(actor.id(),"CLINIC_MEMBER",id,null)) throw ApiProblem.forbidden();
        db.platform();
        return locked(id);
    }
    private void audit(Clinic c,Actor actor,String action,String reason) {
        ReviewEvent event=new ReviewEvent();
        event.clinicId=c.id;event.actorUserId=actor.id();event.action=action;event.reason=reason;
        reviews.save(event);
    }
}
