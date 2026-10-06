package com.clinic.search;

import com.clinic.search.domain.*;
import com.clinic.search.repo.*;
import com.clinic.search.service.SearchProjectionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SearchProjectionServiceTest {
    @Mock PublicClinicRepository clinics;
    @Mock PublicBranchRepository branches;
    @Mock PublicDoctorRepository doctors;
    @Mock PublicOfferingRepository offerings;
    @Mock ProjectionReceiptRepository receipts;
    @Mock JdbcTemplate jdbc;

    @Test
    void clinicDiscoveryAggregatesRealSpecialtiesAndNeverNeedsMarketplaceClinics() {
        UUID clinicId=UUID.randomUUID(), firstBranch=UUID.randomUUID(), secondBranch=UUID.randomUUID();
        UUID doctorId=UUID.randomUUID(), offeringId=UUID.randomUUID();
        PublicClinic clinic=clinic(clinicId);
        PublicBranch first=branch(clinicId,firstBranch),second=branch(clinicId,secondBranch);
        when(clinics.findById(clinicId)).thenReturn(Optional.of(clinic));
        when(branches.findById(firstBranch)).thenReturn(Optional.of(first));
        when(branches.findById(secondBranch)).thenReturn(Optional.of(second));
        when(doctors.findByClinicIdAndPublicVisibleTrueOrderByDisplayNameAsc(clinicId)).thenReturn(List.of(
            doctor(doctorId,clinicId,firstBranch,"BS Nguyễn Minh","TIM","Tim mạch"),
            doctor(doctorId,clinicId,secondBranch,"BS Nguyễn Minh","TIM","Tim mạch")
        ));
        when(offerings.findByClinicIdAndPublicVisibleTrueOrderByNameAsc(clinicId)).thenReturn(List.of(
            offering(offeringId,clinicId,firstBranch,"KHAM_TIM","Khám tim mạch","TIM"),
            offering(offeringId,clinicId,secondBranch,"KHAM_TIM","Khám tim mạch","TIM")
        ));

        var service=new SearchProjectionService(clinics,branches,doctors,offerings,receipts,jdbc);
        var specialties=service.specialties(clinicId,null);
        assertEquals(1,specialties.size());
        assertEquals("TIM",specialties.getFirst().code());
        assertEquals("Tim mạch",specialties.getFirst().name());
        assertEquals(1,specialties.getFirst().doctorCount());
        assertEquals(1,specialties.getFirst().offeringCount());

        var result=service.clinicSearch(clinicId,null,"tim",20);
        assertEquals(1,result.specialties().size());
        assertEquals(2,result.doctors().size());
        assertEquals(2,result.offerings().size());
        verify(clinics,atLeastOnce()).findById(clinicId);
        verify(clinics,never()).search(any(),any());
    }

    @Test
    void specialtyWithoutRealDisplayNameIsNotInventedFromCode() {
        UUID clinicId=UUID.randomUUID(), branchId=UUID.randomUUID();
        when(clinics.findById(clinicId)).thenReturn(Optional.of(clinic(clinicId)));
        when(branches.findById(branchId)).thenReturn(Optional.of(branch(clinicId,branchId)));
        when(doctors.findByClinicIdAndPublicVisibleTrueOrderByDisplayNameAsc(clinicId)).thenReturn(List.of(
            doctor(UUID.randomUUID(),clinicId,branchId,"BS Không khoa","LAB",null)
        ));
        when(offerings.findByClinicIdAndPublicVisibleTrueOrderByNameAsc(clinicId)).thenReturn(List.of(
            offering(UUID.randomUUID(),clinicId,branchId,"CBC","Công thức máu","LAB")
        ));
        var service=new SearchProjectionService(clinics,branches,doctors,offerings,receipts,jdbc);
        assertTrue(service.specialties(clinicId,null).isEmpty());
    }

    private static PublicClinic clinic(UUID id){
        PublicClinic c=new PublicClinic();c.clinicId=id;c.slug="clinic";c.name="Clinic";c.published=true;
        c.sourceVersion=1;c.sourceUpdatedAt=Instant.now();c.indexedAt=Instant.now();return c;
    }
    private static PublicBranch branch(UUID clinicId,UUID id){
        PublicBranch b=new PublicBranch();b.branchId=id;b.clinicId=clinicId;b.name="Branch";b.address="Address";
        b.openingHours="08-17";b.active=true;b.sourceVersion=1;b.indexedAt=Instant.now();return b;
    }
    private static PublicDoctor doctor(UUID id,UUID clinicId,UUID branchId,String name,String specialtyCode,String specialtyName){
        PublicDoctor d=new PublicDoctor();d.doctorId=id;d.clinicId=clinicId;d.branchId=branchId;d.displayName=name;
        d.specialtyCode=specialtyCode;d.specialtyName=specialtyName;d.publicVisible=true;d.sourceVersion=1;d.indexedAt=Instant.now();return d;
    }
    private static PublicOffering offering(UUID id,UUID clinicId,UUID branchId,String code,String name,String specialtyCode){
        PublicOffering o=new PublicOffering();o.offeringId=id;o.clinicId=clinicId;o.branchId=branchId;o.code=code;o.name=name;
        o.specialtyCode=specialtyCode;o.currency="VND";o.publicVisible=true;o.sourceVersion=1;o.indexedAt=Instant.now();return o;
    }
}