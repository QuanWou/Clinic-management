package com.clinic.doctor.service;

import com.clinic.doctor.api.ApiProblem;
import com.clinic.doctor.api.DoctorDto.*;
import com.clinic.doctor.domain.*;
import com.clinic.doctor.repo.*;
import com.clinic.doctor.security.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.*;

@Service
public class DoctorService {
    private final PractitionerRepository practitioners;
    private final DoctorAffiliationRepository affiliations;
    private final WorkingScheduleRepository schedules;
    private final IamAuthorizationClient iam;
    private final ClinicDirectoryClient clinic;
    private final TenantDbContext db;

    public DoctorService(PractitionerRepository practitioners,DoctorAffiliationRepository affiliations,
            WorkingScheduleRepository schedules,IamAuthorizationClient iam,ClinicDirectoryClient clinic,TenantDbContext db){
        this.practitioners=practitioners;this.affiliations=affiliations;this.schedules=schedules;
        this.iam=iam;this.clinic=clinic;this.db=db;
    }

    @Transactional
    public AffiliationView createAffiliation(Actor actor,UUID clinicId,UUID branchId,AffiliationInput input){
        require(actor,"CLINIC_CONFIG",clinicId,branchId);
        clinic.requireBranch(clinicId,branchId);
        var doctorGrant=iam.decide(input.userId(),"DOCTOR_WORK",clinicId,branchId);
        if(!doctorGrant.allowed()||!"DOCTOR".equals(doctorGrant.role()))
            throw ApiProblem.invalid("Target user must have an active DOCTOR membership in this branch");
        db.tenant(clinicId);
        Practitioner p=practitioners.findByPlatformUserId(input.userId()).orElseGet(()->{
            Practitioner n=new Practitioner();n.platformUserId=input.userId();
            n.displayName=input.displayName().trim();n.registrationCode=trim(input.registrationCode());
            return practitioners.saveAndFlush(n);
        });
        // Keep global practitioner identity stable; clinic-specific title/specialty stays on affiliation.
        if(!p.displayName.equals(input.displayName().trim()) || !Objects.equals(p.registrationCode,trim(input.registrationCode()))){
            throw ApiProblem.conflict("Existing practitioner identity differs; branch affiliation cannot change the global profile");
        }
        DoctorAffiliation a=new DoctorAffiliation();
        a.practitionerId=p.id;a.clinicId=clinicId;a.branchId=branchId;
        apply(a,input);
        validateRange(a.effectiveFrom,a.effectiveUntil);
        affiliations.saveAndFlush(a);
        return view(a,p);
    }

    @Transactional
    public AffiliationView updateAffiliation(Actor actor,UUID clinicId,UUID branchId,UUID affiliationId,AffiliationUpdate input){
        require(actor,"CLINIC_CONFIG",clinicId,branchId);
        clinic.requireBranch(clinicId,branchId);
        db.tenant(clinicId);
        DoctorAffiliation a=affiliations.findByIdAndClinicIdAndBranchId(affiliationId,clinicId,branchId)
            .orElseThrow(ApiProblem::missing);
        if(a.version!=input.expectedVersion()) throw ApiProblem.conflict("Affiliation version changed");
        a.specialtyCode=input.specialtyCode().trim();a.specialtyName=input.specialtyName().trim();
        a.professionalTitle=trim(input.professionalTitle());a.effectiveFrom=input.effectiveFrom();
        a.effectiveUntil=input.effectiveUntil();a.active=input.active();a.publicVisible=input.publicVisible();
        validateRange(a.effectiveFrom,a.effectiveUntil);
        affiliations.saveAndFlush(a);
        return view(a,practitioners.findById(a.practitionerId).orElseThrow(ApiProblem::missing));
    }

    @Transactional(readOnly=true)
    public List<AffiliationView> listAffiliations(Actor actor,UUID clinicId,UUID branchId){
        require(actor,"SCHEDULE_READ",clinicId,branchId);
        db.tenant(clinicId);
        return affiliations.findByClinicIdAndBranchIdOrderByCreatedAtAsc(clinicId,branchId).stream()
            .map(a->view(a,practitioners.findById(a.practitionerId).orElseThrow(ApiProblem::missing))).toList();
    }

    @Transactional
    public ScheduleView createSchedule(Actor actor,UUID clinicId,UUID branchId,UUID affiliationId,ScheduleInput input){
        var decision=require(actor,"SCHEDULE_MANAGE",clinicId,branchId);
        clinic.requireBranch(clinicId,branchId);
        db.tenant(clinicId);
        DoctorAffiliation a=affiliations.findByIdAndClinicIdAndBranchId(affiliationId,clinicId,branchId)
            .orElseThrow(ApiProblem::missing);
        Practitioner p=practitioners.findById(a.practitionerId).orElseThrow(ApiProblem::missing);
        requireOwnDoctorSchedule(actor,decision,p);
        WorkingSchedule s=new WorkingSchedule();
        s.affiliationId=a.id;s.practitionerId=p.id;s.clinicId=clinicId;s.branchId=branchId;
        apply(s,input);
        schedules.saveAndFlush(s);
        return view(s);
    }

    @Transactional
    public ScheduleView updateSchedule(Actor actor,UUID clinicId,UUID branchId,UUID affiliationId,UUID scheduleId,ScheduleUpdate input){
        var decision=require(actor,"SCHEDULE_MANAGE",clinicId,branchId);
        clinic.requireBranch(clinicId,branchId);
        db.tenant(clinicId);
        DoctorAffiliation a=affiliations.findByIdAndClinicIdAndBranchId(affiliationId,clinicId,branchId)
            .orElseThrow(ApiProblem::missing);
        Practitioner p=practitioners.findById(a.practitionerId).orElseThrow(ApiProblem::missing);
        requireOwnDoctorSchedule(actor,decision,p);
        WorkingSchedule s=schedules.findByIdAndClinicIdAndBranchId(scheduleId,clinicId,branchId)
            .filter(x->x.affiliationId.equals(affiliationId)).orElseThrow(ApiProblem::missing);
        if(s.version!=input.expectedVersion()) throw ApiProblem.conflict("Schedule version changed");
        apply(s,input);
        schedules.saveAndFlush(s);
        return view(s);
    }

    @Transactional(readOnly=true)
    public DoctorScheduleView schedules(Actor actor,UUID clinicId,UUID branchId,UUID affiliationId){
        require(actor,"SCHEDULE_READ",clinicId,branchId);
        db.tenant(clinicId);
        DoctorAffiliation a=affiliations.findByIdAndClinicIdAndBranchId(affiliationId,clinicId,branchId)
            .orElseThrow(ApiProblem::missing);
        Practitioner p=practitioners.findById(a.practitionerId).orElseThrow(ApiProblem::missing);
        var list=schedules.findByAffiliationIdAndClinicIdAndBranchIdOrderByDayOfWeekAscStartMinuteAsc(affiliationId,clinicId,branchId)
            .stream().map(this::view).toList();
        return new DoctorScheduleView(view(a,p),list);
    }

    @Transactional(readOnly=true)
    public List<PublicDoctorView> publicDoctors(UUID clinicId,UUID branchId){
        db.tenant(clinicId);
        LocalDate today=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        return affiliations.findByClinicIdAndBranchIdOrderByCreatedAtAsc(clinicId,branchId).stream()
            .filter(a->a.active&&a.publicVisible&&!today.isBefore(a.effectiveFrom)&&(a.effectiveUntil==null||today.isBefore(a.effectiveUntil)))
            .map(a->{
                Practitioner p=practitioners.findById(a.practitionerId).orElseThrow(ApiProblem::missing);
                var publicSchedules=schedules.findByAffiliationIdAndClinicIdAndBranchIdOrderByDayOfWeekAscStartMinuteAsc(a.id,clinicId,branchId)
                    .stream().filter(s->s.active)
                    .map(s->new PublicScheduleView(s.dayOfWeek,time(s.startMinute),time(s.endMinute),s.timezone,s.effectiveFrom,s.effectiveUntil,s.version))
                    .toList();
                return new PublicDoctorView(p.id,clinicId,branchId,p.displayName,a.specialtyCode,a.specialtyName,a.professionalTitle,a.version,publicSchedules);
            }).toList();
    }

    public record Assignment(UUID doctorId,UUID clinicId,UUID branchId,UUID userId){}
    @Transactional(readOnly=true)
    public List<Assignment> receptionCandidates(UUID clinicId,UUID branchId,String specialtyCode){
        db.tenant(clinicId);var now=Instant.now();var today=now.atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate();
        if(specialtyCode==null||specialtyCode.isBlank())return List.of();
        return affiliations.findByClinicIdAndBranchIdOrderByCreatedAtAsc(clinicId,branchId).stream()
            .filter(a->a.active&&a.specialtyCode.equalsIgnoreCase(specialtyCode)&&!today.isBefore(a.effectiveFrom)&&(a.effectiveUntil==null||today.isBefore(a.effectiveUntil)))
            .filter(a->schedules.findByAffiliationIdAndClinicIdAndBranchIdOrderByDayOfWeekAscStartMinuteAsc(a.id,clinicId,branchId).stream().anyMatch(s->{
                var local=now.atZone(ZoneId.of(s.timezone));var date=local.toLocalDate();int minute=local.getHour()*60+local.getMinute();
                return s.active&&s.dayOfWeek==date.getDayOfWeek().getValue()&&!date.isBefore(s.effectiveFrom)&&(s.effectiveUntil==null||date.isBefore(s.effectiveUntil))&&minute>=s.startMinute&&minute<s.endMinute;
            })).map(a->{try{return assignment(clinicId,branchId,a.practitionerId);}catch(ApiProblem e){return null;}}).filter(Objects::nonNull).distinct().toList();
    }
    @Transactional(readOnly=true)
    public Assignment assignment(UUID clinicId,UUID branchId,UUID id){
        db.tenant(clinicId);LocalDate today=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        boolean active=affiliations.findByPractitionerIdAndClinicIdAndBranchIdOrderByEffectiveFromDesc(id,clinicId,branchId).stream().anyMatch(a->a.active&&!today.isBefore(a.effectiveFrom)&&(a.effectiveUntil==null||today.isBefore(a.effectiveUntil)));
        if(!active)throw ApiProblem.missing();var p=practitioners.findById(id).orElseThrow(ApiProblem::missing);
        var decision=iam.decide(p.platformUserId,"DOCTOR_WORK",clinicId,branchId);if(!decision.allowed()||!"DOCTOR".equals(decision.role()))throw ApiProblem.missing();
        return new Assignment(id,clinicId,branchId,p.platformUserId);
    }
    private IamAuthorizationClient.Decision require(Actor actor,String capability,UUID clinicId,UUID branchId){
        if(actor==null) throw ApiProblem.missing();
        var d=iam.decide(actor.id(),capability,clinicId,branchId);
        if(!d.allowed()) throw ApiProblem.missing();
        return d;
    }

    private void requireOwnDoctorSchedule(Actor actor,IamAuthorizationClient.Decision decision,Practitioner p){
        if("DOCTOR".equals(decision.role()) && !p.platformUserId.equals(actor.id())) throw ApiProblem.missing();
    }

    private void apply(DoctorAffiliation a,AffiliationInput i){
        a.specialtyCode=i.specialtyCode().trim();a.specialtyName=i.specialtyName().trim();
        a.professionalTitle=trim(i.professionalTitle());a.publicVisible=i.publicVisible();
        a.effectiveFrom=i.effectiveFrom();a.effectiveUntil=i.effectiveUntil();a.active=true;
    }
    private void apply(WorkingSchedule s,ScheduleInput i){
        validateSchedule(i.startTime(),i.endTime(),i.effectiveFrom(),i.effectiveUntil(),i.timezone());
        s.dayOfWeek=(short)i.dayOfWeek();s.startMinute=minutes(i.startTime());s.endMinute=minutes(i.endTime());
        s.timezone=zone(i.timezone());s.effectiveFrom=i.effectiveFrom();s.effectiveUntil=i.effectiveUntil();s.active=i.active();
    }
    private void apply(WorkingSchedule s,ScheduleUpdate i){
        validateSchedule(i.startTime(),i.endTime(),i.effectiveFrom(),i.effectiveUntil(),i.timezone());
        s.dayOfWeek=(short)i.dayOfWeek();s.startMinute=minutes(i.startTime());s.endMinute=minutes(i.endTime());
        s.timezone=zone(i.timezone());s.effectiveFrom=i.effectiveFrom();s.effectiveUntil=i.effectiveUntil();s.active=i.active();
    }
    private void validateSchedule(LocalTime start,LocalTime end,LocalDate from,LocalDate until,String timezone){
        if(!end.isAfter(start)) throw ApiProblem.invalid("Schedule end time must be after start time");
        validateRange(from,until);
        try{ZoneId.of(zone(timezone));}catch(DateTimeException ex){throw ApiProblem.invalid("Invalid schedule timezone");}
    }
    private void validateRange(LocalDate from,LocalDate until){
        if(until!=null&&!until.isAfter(from)) throw ApiProblem.invalid("Effective-until must be after effective-from");
    }
    private int minutes(LocalTime t){return t.getHour()*60+t.getMinute();}
    private LocalTime time(int minutes){return minutes==1440?LocalTime.MIDNIGHT:LocalTime.of(minutes/60,minutes%60);}
    private String zone(String value){return value==null||value.isBlank()?"Asia/Ho_Chi_Minh":value.trim();}
    private String trim(String value){return value==null?null:value.trim();}

    private AffiliationView view(DoctorAffiliation a,Practitioner p){
        return new AffiliationView(a.id,p.id,p.platformUserId,a.clinicId,a.branchId,p.displayName,p.registrationCode,
            a.specialtyCode,a.specialtyName,a.professionalTitle,a.publicVisible,a.effectiveFrom,a.effectiveUntil,a.active,a.version);
    }
    private ScheduleView view(WorkingSchedule s){
        return new ScheduleView(s.id,s.affiliationId,s.practitionerId,s.clinicId,s.branchId,s.dayOfWeek,
            time(s.startMinute),time(s.endMinute),s.timezone,s.effectiveFrom,s.effectiveUntil,s.active,s.version);
    }
}
