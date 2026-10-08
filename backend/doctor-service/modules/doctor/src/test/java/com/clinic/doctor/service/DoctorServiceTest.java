package com.clinic.doctor.service;

import com.clinic.doctor.api.ApiProblem;
import com.clinic.doctor.api.DoctorDto.*;
import com.clinic.doctor.domain.*;
import com.clinic.doctor.repo.*;
import com.clinic.doctor.security.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DoctorServiceTest {
    @Mock PractitionerRepository practitioners;
    @Mock DoctorAffiliationRepository affiliations;
    @Mock WorkingScheduleRepository schedules;
    @Mock IamAuthorizationClient iam;
    @Mock ClinicDirectoryClient clinicDirectory;
    @Mock TenantDbContext db;

    DoctorService service;
    UUID manager=UUID.randomUUID(), doctorUser=UUID.randomUUID(), otherDoctor=UUID.randomUUID();
    UUID clinicA=UUID.randomUUID(), clinicB=UUID.randomUUID(), branchA=UUID.randomUUID(), branchB=UUID.randomUUID();
    Practitioner practitioner;
    DoctorAffiliation affiliation;
    WorkingSchedule schedule;

    @BeforeEach void setup(){
        service=new DoctorService(practitioners,affiliations,schedules,iam,clinicDirectory,db);
        practitioner=new Practitioner();practitioner.id=UUID.randomUUID();practitioner.platformUserId=doctorUser;
        practitioner.displayName="Doctor Synthetic";practitioner.registrationCode="SYN-001";
        affiliation=new DoctorAffiliation();affiliation.id=UUID.randomUUID();affiliation.practitionerId=practitioner.id;
        affiliation.clinicId=clinicA;affiliation.branchId=branchA;affiliation.specialtyCode="GEN";
        affiliation.specialtyName="General";affiliation.effectiveFrom=LocalDate.now();affiliation.active=true;
        schedule=new WorkingSchedule();schedule.id=UUID.randomUUID();schedule.affiliationId=affiliation.id;
        schedule.practitionerId=practitioner.id;schedule.clinicId=clinicA;schedule.branchId=branchA;
        schedule.dayOfWeek=1;schedule.startMinute=480;schedule.endMinute=720;
        schedule.effectiveFrom=LocalDate.now();schedule.timezone="Asia/Ho_Chi_Minh";schedule.active=true;
    }

    IamAuthorizationClient.Decision allow(String role){
        return new IamAuthorizationClient.Decision(true,UUID.randomUUID(),role,1,"ALLOWED");
    }
    IamAuthorizationClient.Decision deny(){
        return new IamAuthorizationClient.Decision(false,null,null,0,"NO_ACTIVE_GRANT");
    }

    @Test void receptionRoutingOnlyUsesMatchingActiveScheduledCanonicalDoctors(){
        var today=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));affiliation.effectiveFrom=today.minusDays(1);
        schedule.dayOfWeek=(short)today.getDayOfWeek().getValue();schedule.startMinute=0;schedule.endMinute=1440;schedule.effectiveFrom=today.minusDays(1);
        when(affiliations.findByClinicIdAndBranchIdOrderByCreatedAtAsc(clinicA,branchA)).thenReturn(List.of(affiliation));
        when(schedules.findByAffiliationIdAndClinicIdAndBranchIdOrderByDayOfWeekAscStartMinuteAsc(affiliation.id,clinicA,branchA)).thenReturn(List.of(schedule));
        when(affiliations.findByPractitionerIdAndClinicIdAndBranchIdOrderByEffectiveFromDesc(practitioner.id,clinicA,branchA)).thenReturn(List.of(affiliation));
        when(practitioners.findById(practitioner.id)).thenReturn(Optional.of(practitioner));
        when(iam.decide(doctorUser,"DOCTOR_WORK",clinicA,branchA)).thenReturn(allow("DOCTOR"));
        assertEquals(practitioner.id,service.receptionCandidates(clinicA,branchA,"GEN").getFirst().doctorId());
        assertTrue(service.receptionCandidates(clinicA,branchA,"OTHER").isEmpty());
        schedule.active=false;assertTrue(service.receptionCandidates(clinicA,branchA,"GEN").isEmpty());schedule.active=true;
        affiliation.active=false;assertTrue(service.receptionCandidates(clinicA,branchA,"GEN").isEmpty());affiliation.active=true;
        when(iam.decide(doctorUser,"DOCTOR_WORK",clinicA,branchA)).thenReturn(deny());assertTrue(service.receptionCandidates(clinicA,branchA,"GEN").isEmpty());
    }

    @Test void affiliationRequiresBranchAdminAndTargetDoctorMembership(){
        Actor actor=new Actor(manager,Set.of("ROLE_ADMIN"));
        when(iam.decide(manager,"CLINIC_CONFIG",clinicA,branchA)).thenReturn(allow("ADMIN"));
        when(iam.decide(doctorUser,"DOCTOR_WORK",clinicA,branchA)).thenReturn(allow("DOCTOR"));
        when(practitioners.findByPlatformUserId(doctorUser)).thenReturn(Optional.of(practitioner));
        when(affiliations.saveAndFlush(any())).thenAnswer(i->i.getArgument(0));

        AffiliationView result=service.createAffiliation(actor,clinicA,branchA,
            new AffiliationInput(doctorUser,"Doctor Synthetic","SYN-001","GEN","General",null,
                LocalDate.now(),null,false));

        assertEquals(clinicA,result.clinicId());
        assertEquals(branchA,result.branchId());
        verify(clinicDirectory).requireBranch(clinicA,branchA);
        verify(db).tenant(clinicA);
    }

    @Test void arbitraryUserCannotBeAffiliatedAsDoctor(){
        Actor actor=new Actor(manager,Set.of("ROLE_ADMIN"));
        when(iam.decide(manager,"CLINIC_CONFIG",clinicA,branchA)).thenReturn(allow("ADMIN"));
        when(iam.decide(otherDoctor,"DOCTOR_WORK",clinicA,branchA)).thenReturn(deny());

        assertThrows(ApiProblem.class,()->service.createAffiliation(actor,clinicA,branchA,
            new AffiliationInput(otherDoctor,"Not a doctor",null,"GEN","General",null,
                LocalDate.now(),null,false)));
        verify(affiliations,never()).saveAndFlush(any());
    }

    @Test void branchManagerCannotOverwriteGlobalPractitionerIdentity(){
        Actor actor=new Actor(manager,Set.of("ROLE_ADMIN"));
        when(iam.decide(manager,"CLINIC_CONFIG",clinicA,branchA)).thenReturn(allow("ADMIN"));
        when(iam.decide(doctorUser,"DOCTOR_WORK",clinicA,branchA)).thenReturn(allow("DOCTOR"));
        when(practitioners.findByPlatformUserId(doctorUser)).thenReturn(Optional.of(practitioner));

        ApiProblem problem=assertThrows(ApiProblem.class,()->service.createAffiliation(actor,clinicA,branchA,
            new AffiliationInput(doctorUser,"Changed at clinic A","SYN-001","GEN","General",null,
                LocalDate.now(),null,false)));

        assertEquals("STATE_CONFLICT",problem.code);
        assertEquals("Doctor Synthetic",practitioner.displayName);
        verify(practitioners,never()).saveAndFlush(any());
        verify(affiliations,never()).saveAndFlush(any());
    }

    @Test void clinicalCapabilityWithoutDoctorRoleCannotCreateDoctorAffiliation(){
        Actor actor=new Actor(manager,Set.of("ROLE_ADMIN"));
        when(iam.decide(manager,"CLINIC_CONFIG",clinicA,branchA)).thenReturn(allow("ADMIN"));
        when(iam.decide(otherDoctor,"DOCTOR_WORK",clinicA,branchA)).thenReturn(allow("NURSE"));

        assertThrows(ApiProblem.class,()->service.createAffiliation(actor,clinicA,branchA,
            new AffiliationInput(otherDoctor,"Synthetic Nurse",null,"GEN","General",null,
                LocalDate.now(),null,false)));
        verifyNoInteractions(practitioners,affiliations,db);
    }

    @Test void doctorCanEditOwnScheduleButNotAnotherDoctor(){
        Actor doctor=new Actor(doctorUser,Set.of("ROLE_DOCTOR"));
        when(affiliations.findByIdAndClinicIdAndBranchId(affiliation.id,clinicA,branchA)).thenReturn(Optional.of(affiliation));
        when(practitioners.findById(practitioner.id)).thenReturn(Optional.of(practitioner));
        when(iam.decide(doctorUser,"SCHEDULE_MANAGE",clinicA,branchA)).thenReturn(allow("DOCTOR"));
        when(schedules.saveAndFlush(any())).thenAnswer(i->i.getArgument(0));

        ScheduleView own=service.createSchedule(doctor,clinicA,branchA,affiliation.id,
            new ScheduleInput(2,LocalTime.of(9,0),LocalTime.of(12,0),LocalDate.now(),null,null,true));
        assertEquals(branchA,own.branchId());

        Practitioner another=new Practitioner();another.id=UUID.randomUUID();another.platformUserId=otherDoctor;another.displayName="Other";
        DoctorAffiliation otherAff=new DoctorAffiliation();otherAff.id=UUID.randomUUID();otherAff.practitionerId=another.id;
        otherAff.clinicId=clinicA;otherAff.branchId=branchA;
        when(affiliations.findByIdAndClinicIdAndBranchId(otherAff.id,clinicA,branchA)).thenReturn(Optional.of(otherAff));
        when(practitioners.findById(another.id)).thenReturn(Optional.of(another));

        assertThrows(ApiProblem.class,()->service.createSchedule(doctor,clinicA,branchA,otherAff.id,
            new ScheduleInput(2,LocalTime.of(13,0),LocalTime.of(17,0),LocalDate.now(),null,null,true)));
    }

    @Test void managerChangingClinicAScheduleNeverQueriesClinicB(){
        Actor actor=new Actor(manager,Set.of("ROLE_ADMIN"));
        when(affiliations.findByIdAndClinicIdAndBranchId(affiliation.id,clinicA,branchA)).thenReturn(Optional.of(affiliation));
        when(practitioners.findById(practitioner.id)).thenReturn(Optional.of(practitioner));
        when(iam.decide(manager,"SCHEDULE_MANAGE",clinicA,branchA)).thenReturn(allow("ADMIN"));
        when(schedules.findByIdAndClinicIdAndBranchId(schedule.id,clinicA,branchA)).thenReturn(Optional.of(schedule));
        when(schedules.saveAndFlush(schedule)).thenReturn(schedule);

        ScheduleView changed=service.updateSchedule(actor,clinicA,branchA,affiliation.id,schedule.id,
            new ScheduleUpdate(0,1,LocalTime.of(8,30),LocalTime.of(11,30),LocalDate.now(),null,"Asia/Ho_Chi_Minh",true));

        assertEquals(LocalTime.of(8,30),changed.startTime());
        verify(db).tenant(clinicA);
        verify(iam).decide(manager,"SCHEDULE_MANAGE",clinicA,branchA);
        verify(iam,never()).decide(any(),anyString(),eq(clinicB),any());
        verify(schedules,never()).findByIdAndClinicIdAndBranchId(any(),eq(clinicB),eq(branchB));
    }

    @Test void staleScheduleVersionIsRejected(){
        Actor actor=new Actor(manager,Set.of("ROLE_ADMIN"));schedule.version=4;
        when(affiliations.findByIdAndClinicIdAndBranchId(affiliation.id,clinicA,branchA)).thenReturn(Optional.of(affiliation));
        when(practitioners.findById(practitioner.id)).thenReturn(Optional.of(practitioner));
        when(iam.decide(manager,"SCHEDULE_MANAGE",clinicA,branchA)).thenReturn(allow("ADMIN"));
        when(schedules.findByIdAndClinicIdAndBranchId(schedule.id,clinicA,branchA)).thenReturn(Optional.of(schedule));

        ApiProblem p=assertThrows(ApiProblem.class,()->service.updateSchedule(actor,clinicA,branchA,affiliation.id,schedule.id,
            new ScheduleUpdate(3,1,LocalTime.of(8,0),LocalTime.of(10,0),LocalDate.now(),null,null,true)));
        assertEquals("STATE_CONFLICT",p.code);
    }

    @Test void invalidScheduleTimeIsRejected(){
        Actor actor=new Actor(manager,Set.of("ROLE_ADMIN"));
        when(affiliations.findByIdAndClinicIdAndBranchId(affiliation.id,clinicA,branchA)).thenReturn(Optional.of(affiliation));
        when(practitioners.findById(practitioner.id)).thenReturn(Optional.of(practitioner));
        when(iam.decide(manager,"SCHEDULE_MANAGE",clinicA,branchA)).thenReturn(allow("ADMIN"));

        assertThrows(ApiProblem.class,()->service.createSchedule(actor,clinicA,branchA,affiliation.id,
            new ScheduleInput(3,LocalTime.of(12,0),LocalTime.of(9,0),LocalDate.now(),null,null,true)));
        verify(schedules,never()).saveAndFlush(any());
    }
}
