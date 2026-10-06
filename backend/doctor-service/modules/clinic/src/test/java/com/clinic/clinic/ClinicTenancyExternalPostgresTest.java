package com.clinic.clinic;

import com.clinic.clinic.api.ApiProblem;
import com.clinic.clinic.api.ClinicDto.DraftInput;
import com.clinic.clinic.security.*;
import com.clinic.clinic.service.ClinicOnboardingService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfSystemProperty(named="clinic.s003.it.enabled",matches="true")
@SpringBootTest(properties={
    "clinic.security.jwt-secret=synthetic-user-jwt-secret-more-than-32-bytes",
    "clinic.security.iam-url=http://127.0.0.1:1",
    "clinic.security.iam-service-secret=synthetic-clinic-to-iam-secret-more-than-32-bytes",
    "clinic.security.iam-directory-secret=synthetic-iam-to-clinic-secret-more-than-32-bytes",
    "clinic.publication.enabled=false"
})
class ClinicTenancyExternalPostgresTest {
    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        String url=System.getProperty("clinic.s003.it.jdbc-url","");
        if(!url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/clinic_v2_s003_clinic_sandbox"))
            throw new IllegalStateException("S0-03 clinic RLS test refuses non-disposable DB: "+url);
        registry.add("spring.datasource.url",()->url);
        registry.add("spring.datasource.username",()->System.getProperty("clinic.s003.it.runtime-user"));
        registry.add("spring.datasource.password",()->System.getProperty("clinic.s003.it.runtime-password"));
    }

    @Autowired ClinicOnboardingService service;
    @Autowired TenantDbContext db;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager txManager;
    @MockBean IamAuthorizationClient iam;

    @Test
    void rlsFailsClosedAndObjectGuardSetsOnlyVerifiedTenant() {
        Actor ownerA=new Actor(UUID.randomUUID(),Set.of("ROLE_ADMIN"));
        Actor ownerB=new Actor(UUID.randomUUID(),Set.of("ROLE_ADMIN"));

        var a=service.create(ownerA,new DraftInput(
            "Clinic A","clinic-a-"+UUID.randomUUID().toString().substring(0,8),
            null,null,null,null,null));
        var b=service.create(ownerB,new DraftInput(
            "Clinic B","clinic-b-"+UUID.randomUUID().toString().substring(0,8),
            null,null,null,null,null));

        assertEquals(0,jdbc.queryForObject("select count(*) from clinic.clinics",Integer.class));

        Integer aRows=new TransactionTemplate(txManager).execute(status->{
            db.tenant(a.id());
            return jdbc.queryForObject("select count(*) from clinic.clinics",Integer.class);
        });
        assertEquals(1,aRows);
        assertEquals(0,jdbc.queryForObject("select count(*) from clinic.clinics",Integer.class));

        Map<String,Object> role=jdbc.queryForMap(
            "select rolsuper, rolbypassrls from pg_roles where rolname=current_user");
        assertEquals(Boolean.FALSE,role.get("rolsuper"));
        assertEquals(Boolean.FALSE,role.get("rolbypassrls"));

        when(iam.allowed(ownerA.id(),"PLATFORM_CLINIC_REVIEW",null,null)).thenReturn(false);
        when(iam.allowed(ownerA.id(),"CLINIC_CONFIG",a.id(),null)).thenReturn(true);
        when(iam.allowed(ownerA.id(),"CLINIC_CONFIG",b.id(),null)).thenReturn(false);

        assertEquals(a.id(),service.owned(ownerA,a.id()).id());
        ApiProblem denied=assertThrows(ApiProblem.class,()->service.owned(ownerA,b.id()));
        assertEquals("NOT_FOUND",denied.code);

        // The denied object request must not leave B as a pooled-connection tenant.
        assertEquals(0,jdbc.queryForObject("select count(*) from clinic.clinics",Integer.class));
        verify(iam).allowed(ownerA.id(),"CLINIC_CONFIG",b.id(),null);
    }
}
