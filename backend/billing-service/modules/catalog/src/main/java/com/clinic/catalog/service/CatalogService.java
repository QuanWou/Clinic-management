package com.clinic.catalog.service;

import com.clinic.catalog.api.ApiProblem;
import com.clinic.catalog.api.CatalogDto.*;
import com.clinic.catalog.domain.*;
import com.clinic.catalog.repo.*;
import com.clinic.catalog.security.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
public class CatalogService {
    private final OfferingRepository offerings;
    private final BranchOfferingRepository branchOfferings;
    private final PriceVersionRepository prices;
    private final IamAuthorizationClient iam;
    private final ClinicDirectoryClient clinic;
    private final TenantDbContext db;

    public CatalogService(OfferingRepository offerings,BranchOfferingRepository branchOfferings,
            PriceVersionRepository prices,IamAuthorizationClient iam,ClinicDirectoryClient clinic,TenantDbContext db){
        this.offerings=offerings;this.branchOfferings=branchOfferings;this.prices=prices;
        this.iam=iam;this.clinic=clinic;this.db=db;
    }

    @Transactional
    public OfferingView createOffering(Actor actor,UUID clinicId,OfferingInput input){
        require(actor,"CATALOG_MANAGE",clinicId,null);
        clinic.requireClinic(clinicId);
        db.tenant(clinicId);
        Offering o=new Offering();o.clinicId=clinicId;o.code=input.code().trim();o.name=input.name().trim();
        o.description=trim(input.description());o.specialtyCode=trim(input.specialtyCode());o.active=input.active();
        offerings.saveAndFlush(o);
        return view(o);
    }

    @Transactional
    public OfferingView updateOffering(Actor actor,UUID clinicId,UUID offeringId,OfferingUpdate input){
        require(actor,"CATALOG_MANAGE",clinicId,null);
        db.tenant(clinicId);
        Offering o=offerings.findByIdAndClinicId(offeringId,clinicId).orElseThrow(ApiProblem::missing);
        if(o.version!=input.expectedVersion()) throw ApiProblem.conflict("Offering version changed");
        o.name=input.name().trim();o.description=trim(input.description());o.specialtyCode=trim(input.specialtyCode());
        o.active=input.active();
        offerings.saveAndFlush(o);
        return view(o);
    }

    @Transactional(readOnly=true)
    public List<OfferingView> listOfferings(Actor actor,UUID clinicId){
        require(actor,"CATALOG_READ",clinicId,null);
        db.tenant(clinicId);
        return offerings.findByClinicIdOrderByCodeAsc(clinicId).stream().map(this::view).toList();
    }

    @Transactional
    public BranchOfferingView assignToBranch(Actor actor,UUID clinicId,UUID branchId,BranchOfferingInput input){
        require(actor,"CATALOG_MANAGE",clinicId,branchId);
        clinic.requireBranch(clinicId,branchId);
        db.tenant(clinicId);
        Offering o=offerings.findByIdAndClinicId(input.offeringId(),clinicId).orElseThrow(ApiProblem::missing);
        if(!o.active) throw ApiProblem.invalid("Inactive offering cannot be enabled for a branch");
        BranchOffering bo=branchOfferings.findByClinicIdAndBranchIdAndOfferingId(clinicId,branchId,o.id).orElse(null);
        if(bo!=null) throw ApiProblem.conflict("Offering is already assigned to this branch");
        bo=new BranchOffering();bo.clinicId=clinicId;bo.branchId=branchId;bo.offeringId=o.id;
        bo.durationMinutes=input.durationMinutes();bo.active=input.active();bo.publicVisible=input.publicVisible();
        branchOfferings.saveAndFlush(bo);
        return view(bo,o);
    }

    @Transactional
    public BranchOfferingView updateBranchOffering(Actor actor,UUID clinicId,UUID branchId,UUID branchOfferingId,
            BranchOfferingUpdate input){
        require(actor,"CATALOG_MANAGE",clinicId,branchId);
        clinic.requireBranch(clinicId,branchId);
        db.tenant(clinicId);
        BranchOffering bo=branchOfferings.findByIdAndClinicIdAndBranchId(branchOfferingId,clinicId,branchId)
            .orElseThrow(ApiProblem::missing);
        if(bo.version!=input.expectedVersion()) throw ApiProblem.conflict("Branch offering version changed");
        bo.durationMinutes=input.durationMinutes();bo.active=input.active();bo.publicVisible=input.publicVisible();
        branchOfferings.saveAndFlush(bo);
        return view(bo,offerings.findByIdAndClinicId(bo.offeringId,clinicId).orElseThrow(ApiProblem::missing));
    }

    @Transactional(readOnly=true)
    public List<BranchOfferingView> listBranchOfferings(Actor actor,UUID clinicId,UUID branchId){
        require(actor,"CATALOG_READ",clinicId,branchId);
        db.tenant(clinicId);
        return branchOfferings.findByClinicIdAndBranchIdOrderByCreatedAtAsc(clinicId,branchId).stream()
            .map(bo->view(bo,offerings.findByIdAndClinicId(bo.offeringId,clinicId).orElseThrow(ApiProblem::missing))).toList();
    }

    @Transactional
    public PriceVersionView createPriceVersion(Actor actor,UUID clinicId,UUID branchId,PriceVersionInput input){
        require(actor,"CATALOG_MANAGE",clinicId,branchId);
        clinic.requireBranch(clinicId,branchId);
        db.tenant(clinicId);
        Offering o=offerings.findByIdAndClinicId(input.offeringId(),clinicId).orElseThrow(ApiProblem::missing);
        if(!o.active) throw ApiProblem.invalid("Inactive offering cannot receive a new price");
        BranchOffering bo=branchOfferings.findByClinicIdAndBranchIdAndOfferingId(clinicId,branchId,o.id)
            .orElseThrow(ApiProblem::missing);
        if(!bo.active) throw ApiProblem.invalid("Inactive branch offering cannot receive a new price");
        PriceVersion p=new PriceVersion();p.clinicId=clinicId;p.branchId=branchId;p.offeringId=o.id;
        p.branchOfferingId=bo.id;p.amountVnd=input.amountVnd();p.currency="VND";
        p.taxPolicyCode=trim(input.taxPolicyCode());p.discountPolicyCode=trim(input.discountPolicyCode());
        p.effectiveFrom=input.effectiveFrom();p.createdBy=actor.id();
        prices.saveAndFlush(p);
        return view(p);
    }

    @Transactional(readOnly=true)
    public List<PriceVersionView> priceHistory(Actor actor,UUID clinicId,UUID branchId,UUID offeringId){
        require(actor,"CATALOG_READ",clinicId,branchId);
        db.tenant(clinicId);
        ensureBranchOffering(clinicId,branchId,offeringId);
        return prices.findByClinicIdAndBranchIdAndOfferingIdOrderByEffectiveFromAsc(clinicId,branchId,offeringId)
            .stream().map(this::view).toList();
    }

    @Transactional(readOnly=true)
    public PriceSnapshot snapshot(Actor actor,UUID clinicId,UUID branchId,UUID offeringId,Instant at){
        require(actor,"CATALOG_READ",clinicId,branchId);
        return resolveSnapshot(clinicId,branchId,offeringId,at);
    }

    @Transactional(readOnly=true)
    public List<PublicOfferingView> publicOfferings(UUID clinicId,UUID branchId){
        db.tenant(clinicId);
        Instant now=Instant.now();
        return branchOfferings.findByClinicIdAndBranchIdOrderByCreatedAtAsc(clinicId,branchId).stream()
            .filter(bo->bo.active&&bo.publicVisible)
            .map(bo->{
                Offering o=offerings.findByIdAndClinicId(bo.offeringId,clinicId).orElseThrow(ApiProblem::missing);
                if(!o.active) return null;
                PriceVersion p=prices.findTopByClinicIdAndBranchIdAndOfferingIdAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(
                    clinicId,branchId,o.id,now).orElse(null);
                if(p==null)return null;
                return new PublicOfferingView(o.id,clinicId,branchId,o.code,o.name,o.description,o.specialtyCode,
                    bo.durationMinutes,p.amountVnd,p.currency,p.id,p.effectiveFrom,p.taxPolicyCode,p.discountPolicyCode,o.version,bo.version);
            }).filter(Objects::nonNull).toList();
    }

    private PriceSnapshot resolveSnapshot(UUID clinicId,UUID branchId,UUID offeringId,Instant at){
        db.tenant(clinicId);
        Offering o=offerings.findByIdAndClinicId(offeringId,clinicId).orElseThrow(ApiProblem::missing);
        BranchOffering bo=ensureBranchOffering(clinicId,branchId,offeringId);
        if(!o.active||!bo.active) throw ApiProblem.invalid("Offering is not active in this branch");
        Instant effectiveAt=at==null?Instant.now():at;
        PriceVersion p=prices.findTopByClinicIdAndBranchIdAndOfferingIdAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(
            clinicId,branchId,offeringId,effectiveAt).orElseThrow(()->ApiProblem.invalid("No effective price at requested time"));
        return new PriceSnapshot(p.id,p.clinicId,p.branchId,p.offeringId,p.amountVnd,p.currency,
            p.taxPolicyCode,p.discountPolicyCode,p.effectiveFrom,Instant.now());
    }

    private BranchOffering ensureBranchOffering(UUID clinicId,UUID branchId,UUID offeringId){
        return branchOfferings.findByClinicIdAndBranchIdAndOfferingId(clinicId,branchId,offeringId)
            .orElseThrow(ApiProblem::missing);
    }

    private IamAuthorizationClient.Decision require(Actor actor,String capability,UUID clinicId,UUID branchId){
        if(actor==null) throw ApiProblem.missing();
        var d=iam.decide(actor.id(),capability,clinicId,branchId);
        if(!d.allowed()) throw ApiProblem.missing();
        return d;
    }
    private String trim(String value){return value==null?null:value.trim();}
    private OfferingView view(Offering o){
        return new OfferingView(o.id,o.clinicId,o.code,o.name,o.description,o.specialtyCode,o.active,o.version);
    }
    private BranchOfferingView view(BranchOffering bo,Offering o){
        return new BranchOfferingView(bo.id,bo.clinicId,bo.branchId,view(o),bo.durationMinutes,bo.active,bo.publicVisible,bo.version);
    }
    private PriceVersionView view(PriceVersion p){
        return new PriceVersionView(p.id,p.clinicId,p.branchId,p.offeringId,p.amountVnd,p.currency,
            p.taxPolicyCode,p.discountPolicyCode,p.effectiveFrom,p.createdBy,p.createdAt);
    }
}
