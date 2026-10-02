package com.clinic.v2.catalog.service;

import com.clinic.v2.catalog.api.ApiProblem;
import com.clinic.v2.catalog.api.CatalogDto.*;
import com.clinic.v2.catalog.domain.*;
import com.clinic.v2.catalog.repo.*;
import com.clinic.v2.catalog.security.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CatalogServiceTest {
    @Mock OfferingRepository offerings;
    @Mock BranchOfferingRepository branchOfferings;
    @Mock PriceVersionRepository prices;
    @Mock IamAuthorizationClient iam;
    @Mock ClinicDirectoryClient clinicDirectory;
    @Mock TenantDbContext db;

    CatalogService service;
    UUID manager=UUID.randomUUID(), clinicA=UUID.randomUUID(), clinicB=UUID.randomUUID();
    UUID branchA=UUID.randomUUID(), branchB=UUID.randomUUID();
    Offering offering;
    BranchOffering branchOffering;

    @BeforeEach void setup(){
        service=new CatalogService(offerings,branchOfferings,prices,iam,clinicDirectory,db);
        offering=new Offering();offering.id=UUID.randomUUID();offering.clinicId=clinicA;offering.code="CONSULT";
        offering.name="Consultation";offering.active=true;
        branchOffering=new BranchOffering();branchOffering.id=UUID.randomUUID();branchOffering.clinicId=clinicA;
        branchOffering.branchId=branchA;branchOffering.offeringId=offering.id;branchOffering.active=true;
    }

    IamAuthorizationClient.Decision allow(String role){
        return new IamAuthorizationClient.Decision(true,UUID.randomUUID(),role,1,"ALLOWED");
    }
    Actor actor(){return new Actor(manager,Set.of("ROLE_ADMIN"));}

    @Test void clinicMasterOfferingRequiresClinicWideCatalogPermission(){
        when(iam.decide(manager,"CATALOG_MANAGE",clinicA,null)).thenReturn(allow("CLINIC_OWNER"));
        when(offerings.saveAndFlush(any())).thenAnswer(i->i.getArgument(0));

        OfferingView result=service.createOffering(actor(),clinicA,
            new OfferingInput("CONSULT","Consultation",null,"GEN",true));

        assertEquals(clinicA,result.clinicId());
        verify(clinicDirectory).requireClinic(clinicA);
        verify(db).tenant(clinicA);
    }

    @Test void branchOfferingRequiresExactBranchPermission(){
        when(iam.decide(manager,"CATALOG_MANAGE",clinicA,branchA)).thenReturn(allow("CLINIC_MANAGER"));
        when(offerings.findByIdAndClinicId(offering.id,clinicA)).thenReturn(Optional.of(offering));
        when(branchOfferings.findByClinicIdAndBranchIdAndOfferingId(clinicA,branchA,offering.id)).thenReturn(Optional.empty());
        when(branchOfferings.saveAndFlush(any())).thenAnswer(i->i.getArgument(0));

        BranchOfferingView result=service.assignToBranch(actor(),clinicA,branchA,
            new BranchOfferingInput(offering.id,30,true,true));

        assertEquals(branchA,result.branchId());
        verify(clinicDirectory).requireBranch(clinicA,branchA);
        verify(iam).decide(manager,"CATALOG_MANAGE",clinicA,branchA);
        verify(iam,never()).decide(any(),anyString(),eq(clinicB),any());
    }

    @Test void priceChangeCreatesNewImmutableVersionAndHistoricalSnapshotStaysOld(){
        Instant oldStart=Instant.parse("2026-01-01T00:00:00Z");
        Instant newStart=Instant.parse("2026-10-01T00:00:00Z");
        Instant historical=Instant.parse("2026-09-01T00:00:00Z");
        PriceVersion old=new PriceVersion();old.id=UUID.randomUUID();old.clinicId=clinicA;old.branchId=branchA;
        old.offeringId=offering.id;old.branchOfferingId=branchOffering.id;old.amountVnd=100000;old.currency="VND";
        old.effectiveFrom=oldStart;old.createdBy=manager;old.createdAt=oldStart;
        when(iam.decide(manager,"CATALOG_MANAGE",clinicA,branchA)).thenReturn(allow("CLINIC_MANAGER"));
        when(iam.decide(manager,"CATALOG_READ",clinicA,branchA)).thenReturn(allow("CLINIC_MANAGER"));
        when(offerings.findByIdAndClinicId(offering.id,clinicA)).thenReturn(Optional.of(offering));
        when(branchOfferings.findByClinicIdAndBranchIdAndOfferingId(clinicA,branchA,offering.id))
            .thenReturn(Optional.of(branchOffering));
        when(prices.saveAndFlush(any())).thenAnswer(i->i.getArgument(0));
        when(prices.findTopByClinicIdAndBranchIdAndOfferingIdAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(
            clinicA,branchA,offering.id,historical)).thenReturn(Optional.of(old));

        PriceVersionView created=service.createPriceVersion(actor(),clinicA,branchA,
            new PriceVersionInput(offering.id,120000,newStart,null,null));
        PriceSnapshot snapshot=service.snapshot(actor(),clinicA,branchA,offering.id,historical);

        assertEquals(120000,created.amountVnd());
        assertEquals(100000,snapshot.amountVnd());
        assertEquals(old.id,snapshot.priceVersionId());
        assertEquals(100000,old.amountVnd);
        assertEquals(oldStart,old.effectiveFrom);
        verify(prices).saveAndFlush(argThat(p->p.amountVnd==120000 && p.effectiveFrom.equals(newStart)));
    }

    @Test void priceInClinicADoesNotTouchClinicB(){
        when(iam.decide(manager,"CATALOG_MANAGE",clinicA,branchA)).thenReturn(allow("CLINIC_MANAGER"));
        when(offerings.findByIdAndClinicId(offering.id,clinicA)).thenReturn(Optional.of(offering));
        when(branchOfferings.findByClinicIdAndBranchIdAndOfferingId(clinicA,branchA,offering.id))
            .thenReturn(Optional.of(branchOffering));
        when(prices.saveAndFlush(any())).thenAnswer(i->i.getArgument(0));

        service.createPriceVersion(actor(),clinicA,branchA,
            new PriceVersionInput(offering.id,150000,Instant.parse("2026-11-01T00:00:00Z"),null,null));

        verify(db).tenant(clinicA);
        verify(iam,never()).decide(any(),anyString(),eq(clinicB),any());
        verify(branchOfferings,never()).findByClinicIdAndBranchIdAndOfferingId(eq(clinicB),eq(branchB),any());
    }

    @Test void inactiveBranchOfferingCannotProducePriceSnapshot(){
        branchOffering.active=false;
        when(iam.decide(manager,"CATALOG_READ",clinicA,branchA)).thenReturn(allow("CLINIC_MANAGER"));
        when(offerings.findByIdAndClinicId(offering.id,clinicA)).thenReturn(Optional.of(offering));
        when(branchOfferings.findByClinicIdAndBranchIdAndOfferingId(clinicA,branchA,offering.id))
            .thenReturn(Optional.of(branchOffering));

        ApiProblem p=assertThrows(ApiProblem.class,()->service.snapshot(actor(),clinicA,branchA,offering.id,Instant.now()));
        assertEquals("INVALID_CATALOG_STATE",p.code);
        verify(prices,never()).findTopByClinicIdAndBranchIdAndOfferingIdAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(
            any(),any(),any(),any());
    }

    @Test void staleOfferingVersionIsRejected(){
        offering.version=3;
        when(iam.decide(manager,"CATALOG_MANAGE",clinicA,null)).thenReturn(allow("CLINIC_OWNER"));
        when(offerings.findByIdAndClinicId(offering.id,clinicA)).thenReturn(Optional.of(offering));

        ApiProblem p=assertThrows(ApiProblem.class,()->service.updateOffering(actor(),clinicA,offering.id,
            new OfferingUpdate(2,"Changed",null,"GEN",true)));
        assertEquals("STATE_CONFLICT",p.code);
        verify(offerings,never()).saveAndFlush(any());
    }
}
