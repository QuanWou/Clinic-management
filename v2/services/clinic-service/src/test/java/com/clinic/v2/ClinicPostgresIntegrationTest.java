package com.clinic.v2;

import com.clinic.v2.api.ApiProblem;
import com.clinic.v2.api.ClinicDto.*;
import com.clinic.v2.domain.*;
import com.clinic.v2.repo.*;
import com.clinic.v2.security.Actor;
import com.clinic.v2.security.IamAuthorizationClient;
import com.clinic.v2.service.ClinicOnboardingService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Testcontainers(disabledWithoutDocker=true)
@SpringBootTest(properties={
    "clinic.publication.enabled=true",
    "clinic.security.jwt-secret=synthetic-test-secret-32-byte-minimum-123",
    "clinic.security.iam-service-secret=synthetic-clinic-to-iam-secret-more-than-32-bytes",
    "clinic.security.iam-directory-secret=synthetic-iam-to-clinic-secret-more-than-32-bytes"
})
@AutoConfigureMockMvc
class ClinicPostgresIntegrationTest {
    @Container static PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgres:16-alpine").withDatabaseName("clinic_v2_s002_test")
            .withUsername("synthetic_owner").withPassword("synthetic_password");
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry){
        registry.add("spring.datasource.url",postgres::getJdbcUrl);
        registry.add("spring.datasource.username",postgres::getUsername);
        registry.add("spring.datasource.password",postgres::getPassword);
    }
    @Autowired ClinicOnboardingService service;
    @Autowired ClinicRepository clinics;
    @Autowired BranchRepository branches;
    @Autowired LicenseRepository licenses;
    @Autowired ReviewRepository reviews;
    @Autowired MockMvc mvc;
    @MockBean IamAuthorizationClient iam;

    final Actor owner=new Actor(UUID.fromString("22222222-2222-4222-8222-222222222222"),Set.of("ROLE_PATIENT"));
    final Actor op=new Actor(UUID.fromString("11111111-1111-4111-8111-111111111111"),Set.of("ROLE_ADMIN"));

    @BeforeEach void cleanOnlyDisposableContainer(){
        when(iam.allowed(owner.id(),"CLINIC_MEMBERSHIP_ADMIN",any(),isNull())).thenReturn(true);
        when(iam.allowed(op.id(),"PLATFORM_CLINIC_REVIEW",null,null)).thenReturn(true);
        when(iam.allowed(op.id(),"CLINIC_MEMBERSHIP_ADMIN",any(),isNull())).thenReturn(false);
        reviews.deleteAll();branches.deleteAll();licenses.deleteAll();clinics.deleteAll();
    }

    private UUID createAndSubmit(){
        var draft=service.create(owner,new DraftInput("Synthetic Clinic","synthetic-clinic","Public text",
            "Owner","owner@example.test","0900000000",
            new LicenseInput("SYN-001","Synthetic testing authority","Outpatient",
                "private/test-evidence",LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusYears(1))));
        service.addBranch(owner,draft.id(),new BranchInput("Main","Synthetic Address","09:00-17:00",true));
        service.submit(owner,draft.id());
        return draft.id();
    }
    @Test void migrationsAndPublicProjectionExcludePrivateEvidence() throws Exception {
        UUID id=createAndSubmit();
        assertEquals(0,service.publicList(PageRequest.of(0,10)).getTotalElements());
        mvc.perform(get("/api/v2/public/clinics/synthetic-clinic"))
            .andExpect(status().isNotFound());
        service.approve(op,id,new DecisionInput("Synthetic review approved",true));
        assertEquals(0,service.publicList(PageRequest.of(0,10)).getTotalElements());
        service.publish(op,id,new ReasonInput("Test-only publication"));
        assertEquals(1,service.publicList(PageRequest.of(0,10)).getTotalElements());
        mvc.perform(get("/api/v2/public/clinics/synthetic-clinic"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.slug").value("synthetic-clinic"))
            .andExpect(jsonPath("$.branches[0].name").value("Main"))
            .andExpect(jsonPath("$.license").doesNotExist())
            .andExpect(jsonPath("$.contactEmail").doesNotExist())
            .andExpect(jsonPath("$.evidenceRef").doesNotExist());
        assertTrue(service.bookingEligibility(id,branches.findByClinicIdOrderByCreatedAtAsc(id).get(0).id).eligible());
        assertEquals(5,service.history(owner,id).size()); // created, branch, submitted, approved, published
    }
    @Test void suspensionRemovesFromPublicButPreservesOriginalRow() throws Exception {
        UUID id=createAndSubmit();
        service.approve(op,id,new DecisionInput("Synthetic reviewer",true));
        service.publish(op,id,new ReasonInput("synthetic published"));
        service.suspend(op,id,new ReasonInput("suspend pending review"));
        assertEquals(0,service.publicList(PageRequest.of(0,10)).getTotalElements());
        assertEquals(PublicationStatus.SUSPENDED,clinics.findById(id).orElseThrow().publicationStatus);
        mvc.perform(get("/api/v2/public/clinics/synthetic-clinic")).andExpect(status().isNotFound());
    }
    @Test void unauthenticatedPrivateEndpointsFailClosed() throws Exception {
        mvc.perform(post("/api/v2/clinics").contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"x\",\"slug\":\"x\"}")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v2/platform/clinics")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v2/internal/clinics/"+UUID.randomUUID()+"/booking-eligibility")
            .param("branchId",UUID.randomUUID().toString())).andExpect(status().isForbidden());
    }
}
