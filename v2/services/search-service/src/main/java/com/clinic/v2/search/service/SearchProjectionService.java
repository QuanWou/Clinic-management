package com.clinic.v2.search.service;

import com.clinic.v2.search.api.*;
import com.clinic.v2.search.api.SearchDto.*;
import com.clinic.v2.search.domain.*;
import com.clinic.v2.search.repo.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
public class SearchProjectionService {
  private final PublicClinicRepository clinics;
  private final PublicBranchRepository branches;
  private final PublicDoctorRepository doctors;
  private final PublicOfferingRepository offerings;
  private final ProjectionReceiptRepository receipts;
  private final JdbcTemplate jdbc;

  public SearchProjectionService(PublicClinicRepository clinics,PublicBranchRepository branches,
      PublicDoctorRepository doctors,PublicOfferingRepository offerings,ProjectionReceiptRepository receipts,JdbcTemplate jdbc){
    this.clinics=clinics;this.branches=branches;this.doctors=doctors;this.offerings=offerings;this.receipts=receipts;
    this.jdbc=jdbc;
  }

  @Transactional
  public ProjectionResult projectClinic(ClinicProjectionInput in){
    lockClinic(in.clinicId());
    var key=new ProjectionReceipt.Key("clinic-v2-service","clinic",in.clinicId());
    var prior=receipts.findById(key).orElse(null);
    if(prior!=null&&prior.sourceVersion>=in.sourceVersion())
      return new ProjectionResult(false,"STALE_OR_REPLAY",prior.sourceVersion,prior.indexedAt);

    PublicClinic c=clinics.findById(in.clinicId()).orElseGet(PublicClinic::new);
    c.clinicId=in.clinicId();c.slug=in.slug();c.name=in.name();c.description=in.description();c.locationText=in.locationText();
    c.published=in.published();c.sourceVersion=in.sourceVersion();c.sourceUpdatedAt=in.sourceUpdatedAt();clinics.save(c);

    if(!in.published()){
      // Preserve child versions across suspension. Public reads check current parent publication.
    }else{
      Set<UUID> incoming=new HashSet<>();
      for(BranchInput b:Optional.ofNullable(in.branches()).orElse(List.of())){
        incoming.add(b.branchId());
        PublicBranch row=branches.findById(b.branchId()).orElseGet(PublicBranch::new);
        if(row.clinicId!=null&&!row.clinicId.equals(in.clinicId()))throw ApiProblem.forbidden();
        row.branchId=b.branchId();row.clinicId=in.clinicId();row.name=b.name();row.address=b.address();
        row.openingHours=b.openingHours();row.active=b.active();row.sourceVersion=b.sourceVersion();branches.save(row);
      }
      for(PublicBranch existing:branches.findByClinicIdAndActiveTrueOrderByNameAsc(in.clinicId())){
        if(!incoming.contains(existing.branchId)){existing.active=false;branches.save(existing);}
      }
    }
    ProjectionReceipt rec=prior==null?new ProjectionReceipt():prior;
    rec.source="clinic-v2-service";rec.aggregateType="clinic";rec.aggregateId=in.clinicId();
    rec.sourceVersion=in.sourceVersion();rec.eventId=in.eventId();receipts.save(rec);
    return new ProjectionResult(true,"APPLIED",in.sourceVersion(),Instant.now());
  }

  @Transactional
  public ProjectionResult projectDoctor(DoctorProjectionInput in){
    lockClinic(in.clinicId());
    ensurePublishedBranch(in.clinicId(),in.branchId());
    UUID scopedId=scopeKey(in.doctorId(),in.clinicId(),in.branchId());
    var key=new ProjectionReceipt.Key("doctor-v2-service","doctor",scopedId);
    var prior=receipts.findById(key).orElse(null);
    if(prior!=null&&prior.sourceVersion>=in.sourceVersion())
      return new ProjectionResult(false,"STALE_OR_REPLAY",prior.sourceVersion,prior.indexedAt);

    PublicDoctor d=new PublicDoctor();
    d.doctorId=in.doctorId();d.clinicId=in.clinicId();d.branchId=in.branchId();d.displayName=in.displayName();
    d.specialtyCode=in.specialtyCode();d.specialtyName=in.specialtyName();d.professionalTitle=in.professionalTitle();
    d.publicVisible=in.publicVisible();d.sourceVersion=in.sourceVersion();doctors.save(d);
    receipt("doctor-v2-service","doctor",scopedId,in.sourceVersion(),in.eventId());
    return new ProjectionResult(true,"APPLIED",in.sourceVersion(),Instant.now());
  }

  @Transactional
  public ProjectionResult projectOffering(OfferingProjectionInput in){
    lockClinic(in.clinicId());
    ensurePublishedBranch(in.clinicId(),in.branchId());
    UUID scopedId=scopeKey(in.offeringId(),in.clinicId(),in.branchId());
    var key=new ProjectionReceipt.Key("catalog-v2-service","offering",scopedId);
    var prior=receipts.findById(key).orElse(null);
    if(prior!=null&&prior.sourceVersion>=in.sourceVersion())
      return new ProjectionResult(false,"STALE_OR_REPLAY",prior.sourceVersion,prior.indexedAt);
    PublicOffering o=new PublicOffering();
    o.offeringId=in.offeringId();o.clinicId=in.clinicId();o.branchId=in.branchId();o.code=in.code();o.name=in.name();
    o.specialtyCode=in.specialtyCode();o.amountVnd=in.amountVnd();o.currency=in.currency()==null?"VND":in.currency();
    o.priceVersionId=in.priceVersionId();o.effectiveFrom=in.effectiveFrom();o.publicVisible=in.publicVisible();o.sourceVersion=in.sourceVersion();
    offerings.save(o);
    receipt("catalog-v2-service","offering",scopedId,in.sourceVersion(),in.eventId());
    return new ProjectionResult(true,"APPLIED",in.sourceVersion(),Instant.now());
  }

  @Transactional(readOnly=true)
  public SearchResponse search(String q,int limit){
    String query=q==null||q.isBlank()?null:q.trim();
    int size=Math.max(1,Math.min(limit,50));
    var page=PageRequest.of(0,size);
    var clinicViews=clinics.search(query,page).stream().map(this::clinicView).toList();
    var doctorViews=query==null?List.<DoctorView>of():doctors.search(query,page).stream().map(this::doctorView).toList();
    var offeringViews=query==null?List.<OfferingView>of():offerings.search(query,page).stream().map(this::offeringView).toList();
    return new SearchResponse(clinicViews,doctorViews,offeringViews);
  }

  @Transactional(readOnly=true)
  public ClinicCard clinic(UUID id){
    PublicClinic c=clinics.findById(id).filter(x->x.published).orElseThrow(ApiProblem::missing);
    return clinicView(c);
  }

  @Transactional(readOnly=true)
  public List<DoctorView> doctors(UUID clinicId,UUID branchId){
    clinic(clinicId);
    if(branchId!=null)ensurePublishedBranch(clinicId,branchId);
    return (branchId==null?doctors.findByClinicIdAndPublicVisibleTrueOrderByDisplayNameAsc(clinicId):
      doctors.findByClinicIdAndBranchIdAndPublicVisibleTrueOrderByDisplayNameAsc(clinicId,branchId)).stream()
      .filter(d->branches.findById(d.branchId).map(b->b.active&&b.clinicId.equals(clinicId)).orElse(false)).map(this::doctorView).toList();
  }

  @Transactional(readOnly=true)
  public List<OfferingView> offerings(UUID clinicId,UUID branchId){
    clinic(clinicId);
    if(branchId!=null)ensurePublishedBranch(clinicId,branchId);
    return (branchId==null?offerings.findByClinicIdAndPublicVisibleTrueOrderByNameAsc(clinicId):
      offerings.findByClinicIdAndBranchIdAndPublicVisibleTrueOrderByNameAsc(clinicId,branchId)).stream()
      .filter(o->branches.findById(o.branchId).map(b->b.active&&b.clinicId.equals(clinicId)).orElse(false)).map(this::offeringView).toList();
  }

  private void ensurePublishedBranch(UUID clinicId,UUID branchId){
    PublicClinic c=clinics.findById(clinicId).filter(x->x.published).orElseThrow(ApiProblem::missing);
    PublicBranch b=branches.findById(branchId).filter(x->x.active&&clinicId.equals(x.clinicId)).orElseThrow(ApiProblem::missing);
  }
  private void lockClinic(UUID clinicId){
    jdbc.execute("select pg_advisory_xact_lock(hashtextextended('search:"+clinicId+"',0))");
  }
  private UUID scopeKey(UUID object,UUID clinic,UUID branch){
    return UUID.nameUUIDFromBytes((object+"|"+clinic+"|"+branch).getBytes(java.nio.charset.StandardCharsets.UTF_8));
  }
  private void receipt(String source,String type,UUID id,long version,UUID eventId){
    ProjectionReceipt rec=receipts.findById(new ProjectionReceipt.Key(source,type,id)).orElseGet(ProjectionReceipt::new);
    rec.source=source;rec.aggregateType=type;rec.aggregateId=id;rec.sourceVersion=version;rec.eventId=eventId;receipts.save(rec);
  }
  private ClinicCard clinicView(PublicClinic c){
    var b=branches.findByClinicIdAndActiveTrueOrderByNameAsc(c.clinicId).stream()
      .map(x->new BranchView(x.branchId,x.name,x.address,x.openingHours)).toList();
    return new ClinicCard(c.clinicId,c.slug,c.name,c.description,c.locationText,c.sourceUpdatedAt,c.indexedAt,b);
  }
  private DoctorView doctorView(PublicDoctor d){return new DoctorView(d.doctorId,d.clinicId,d.branchId,d.displayName,d.specialtyCode,d.specialtyName,d.professionalTitle,d.sourceVersion,d.indexedAt);}
  private OfferingView offeringView(PublicOffering o){return new OfferingView(o.offeringId,o.clinicId,o.branchId,o.code,o.name,o.specialtyCode,o.amountVnd,o.currency,o.priceVersionId,o.effectiveFrom,o.sourceVersion,o.indexedAt);}
}
