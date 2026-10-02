package com.clinic.v2;

import com.clinic.v2.api.ClinicDto.*;
import com.clinic.v2.domain.*;
import com.clinic.v2.repo.*;
import com.clinic.v2.security.Actor;
import com.clinic.v2.security.IamAuthorizationClient;
import com.clinic.v2.service.ClinicOnboardingService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@EnabledIfSystemProperty(named="clinic.it.enabled", matches="true")
@SpringBootTest(properties={
    "clinic.publication.enabled=true",
    "clinic.security.jwt-secret=synthetic-test-secret-32-byte-minimum-123",
    "clinic.security.iam-service-secret=synthetic-clinic-to-iam-secret-more-than-32-bytes",
    "clinic.security.iam-directory-secret=synthetic-iam-to-clinic-secret-more-than-32-bytes"
})
@AutoConfigureMockMvc
class ClinicExternalPostgresTest {
    // This suite runs ONLY with explicit properties pointing at the disposable S0-02 container.
    @DynamicPropertySource static void db(DynamicPropertyRegistry registry) {
        String url=System.getProperty("clinic.it.jdbc-url","");
        if(!url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/clinic_v2_s002_sandbox"))
            throw new IllegalStateException("S0-02 external test refuses non-disposable database: "+url);
        registry.add("spring.datasource.url",()->url);
        registry.add("spring.datasource.username",()->System.getProperty("clinic.it.user"));
        registry.add("spring.datasource.password",()->System.getProperty("clinic.it.password"));
    }
    @Autowired ClinicOnboardingService service;
    @Autowired ClinicRepository clinics;
    @Autowired BranchRepository branches;
    @Autowired LicenseRepository licenses;
    @Autowired ReviewRepository reviews;
    @Autowired MockMvc mvc;
    @MockBean IamAuthorizationClient iam;

    private final Actor owner=new Actor(UUID.fromString("22222222-2222-4222-8222-222222222222"),Set.of("ROLE_PATIENT"));
    private final Actor operator=new Actor(UUID.fromString("11111111-1111-4111-8111-111111111111"),Set.of("ROLE_ADMIN"));

    @BeforeEach void isolatedOnly(){
        when(iam.allowed(owner.id(),"CLINIC_MEMBERSHIP_ADMIN",any(),isNull())).thenReturn(true);
        when(iam.allowed(operator.id(),"PLATFORM_CLINIC_REVIEW",null,null)).thenReturn(true);
        when(iam.allowed(operator.id(),"CLINIC_MEMBERSHIP_ADMIN",any(),isNull())).thenReturn(false);
        reviews.deleteAll();branches.deleteAll();licenses.deleteAll();clinics.deleteAll();
    }

    @Test void fullOnboardingPublicationAndSuspensionOnRealPostgres() throws Exception{
        var c=service.create(owner,new DraftInput("Demo clinic","demo-clinic","Safe approved text",
            "Owner","owner@example.test","0900000000",
            new LicenseInput("SYN-111","Synthetic regulator","Outpatient","private/test-evidence",
                LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusMonths(2))));
        service.addBranch(owner,c.id(),new BranchInput("Main","Synthetic Test Address","09:00-17:00",true));
        service.submit(owner,c.id());
        assertEquals(0,service.publicList(PageRequest.of(0,10)).getTotalElements());
        service.approve(operator,c.id(),new DecisionInput("Reviewed synthetic evidence",true));
        assertEquals(0,service.publicList(PageRequest.of(0,10)).getTotalElements());
        service.publish(operator,c.id(),new ReasonInput("Synthetic release"));
        assertEquals(1,service.publicList(PageRequest.of(0,10)).getTotalElements());
        mvc.perform(get("/api/v2/public/clinics/demo-clinic"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Demo clinic"))
            .andExpect(jsonPath("$.contactEmail").doesNotExist())
            .andExpect(jsonPath("$.license").doesNotExist())
            .andExpect(jsonPath("$.evidenceRef").doesNotExist());
        UUID branchId=branches.findByClinicIdOrderByCreatedAtAsc(c.id()).get(0).id;
        assertTrue(service.bookingEligibility(c.id(),branchId).eligible());
        service.suspend(operator,c.id(),new ReasonInput("Synthetic suspend"));
        assertFalse(service.bookingEligibility(c.id(),branchId).eligible());
        assertEquals(0,service.publicList(PageRequest.of(0,10)).getTotalElements());
        mvc.perform(get("/api/v2/public/clinics/demo-clinic")).andExpect(status().isNotFound());
        assertEquals(6,service.history(owner,c.id()).size());
    }
    @Test void publicRouteCannotSeeDraftOrPrivateEndpoints() throws Exception{
        var c=service.create(owner,new DraftInput("Private draft","private-draft",null,null,null,null,null));
        mvc.perform(get("/api/v2/public/clinics/private-draft")).andExpect(status().isNotFound());
        mvc.perform(get("/api/v2/clinics/"+c.id())).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v2/platform/clinics")).andExpect(status().isUnauthorized());
    }
}
