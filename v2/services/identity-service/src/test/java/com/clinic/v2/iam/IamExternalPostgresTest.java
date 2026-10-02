package com.clinic.v2.iam;

import com.clinic.v2.iam.api.Capability;
import com.clinic.v2.iam.api.IamDto.*;
import com.clinic.v2.iam.domain.*;
import com.clinic.v2.iam.repo.MembershipRepository;
import com.clinic.v2.iam.security.*;
import com.clinic.v2.iam.service.MembershipService;
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

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@EnabledIfSystemProperty(named="iam.it.enabled", matches="true")
@SpringBootTest(properties={
    "iam.security.jwt-secret=synthetic-user-jwt-secret-more-than-32-bytes",
    "iam.security.workload-inbound-secret=synthetic-clinic-to-iam-secret-more-than-32-bytes",
    "iam.security.workload-audience=identity-v2-service",
    "iam.security.allowed-workload-issuers=clinic-v2-service",
    "iam.clinic.url=http://127.0.0.1:1",
    "iam.clinic.workload-issuer=identity-v2-service",
    "iam.clinic.workload-audience=clinic-v2-service",
    "iam.clinic.workload-outbound-secret=synthetic-iam-to-clinic-secret-more-than-32-bytes"
})
class IamExternalPostgresTest {
    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        String url=System.getProperty("iam.it.jdbc-url","");
        if(!url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/clinic_v2_s003_sandbox"))
            throw new IllegalStateException("S0-03 test refuses non-disposable DB: "+url);
        registry.add("spring.datasource.url",()->url);
        registry.add("spring.datasource.username",()->System.getProperty("iam.it.runtime-user"));
        registry.add("spring.datasource.password",()->System.getProperty("iam.it.runtime-password"));
        registry.add("spring.flyway.user",()->System.getProperty("iam.it.migrator-user"));
        registry.add("spring.flyway.password",()->System.getProperty("iam.it.migrator-password"));
    }

    @Autowired MembershipService memberships;
    @Autowired MembershipRepository repository;
    @Autowired SessionSecurityService sessions;
    @Autowired DatabaseScope scope;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager txManager;

    @MockBean ClinicDirectoryClient clinicDirectory;

    UUID clinicA;
    UUID clinicB;
    UUID branchA;
    UUID branchB;
    UUID ownerA;
    UUID ownerB;

    @BeforeEach
    void fixtures() {
        clinicA=UUID.randomUUID();clinicB=UUID.randomUUID();
        branchA=UUID.randomUUID();branchB=UUID.randomUUID();
        ownerA=UUID.randomUUID();ownerB=UUID.randomUUID();

        when(clinicDirectory.clinicOwnedBy(clinicA,ownerA)).thenReturn(true);
        when(clinicDirectory.clinicOwnedBy(clinicB,ownerB)).thenReturn(true);
        when(clinicDirectory.clinicExists(any())).thenReturn(true);
        when(clinicDirectory.branchExists(clinicA,branchA)).thenReturn(true);
        when(clinicDirectory.branchExists(clinicB,branchB)).thenReturn(true);

        memberships.bootstrapOwner(clinicA,ownerA);
        memberships.bootstrapOwner(clinicB,ownerB);
    }

    @Test
    void missingTransactionTenantContextFailsClosedAndRuntimeRoleCannotBypassRls() {
        // Previous service transactions used SET LOCAL; outside those
        // transactions the pooled connection must not retain scope.
        Integer invisible=jdbc.queryForObject("select count(*) from iam.memberships",Integer.class);
        assertEquals(0,invisible);

        Map<String,Object> role=jdbc.queryForMap(
            "select rolsuper, rolbypassrls from pg_roles where rolname=current_user");
        assertEquals(Boolean.FALSE,role.get("rolsuper"));
        assertEquals(Boolean.FALSE,role.get("rolbypassrls"));

        Integer own=new TransactionTemplate(txManager).execute(status -> {
            scope.user(ownerA);
            return jdbc.queryForObject("select count(*) from iam.memberships",Integer.class);
        });
        assertEquals(1,own);

        // A new transaction/connection checkout must not retain the previous
        // SET LOCAL context.
        assertEquals(0,jdbc.queryForObject("select count(*) from iam.memberships",Integer.class));
    }

    @Test
    void crossTenantContextAndRevocationAreDeniedImmediately() {
        AuthorizationDecision own=memberships.authorize(
            new AuthorizationRequest(ownerA,clinicA,null,Capability.CLINIC_CONFIG));
        assertTrue(own.allowed());

        AuthorizationDecision guessed=memberships.authorize(
            new AuthorizationRequest(ownerA,clinicB,null,Capability.CLINIC_CONFIG));
        assertFalse(guessed.allowed());
        assertEquals("NO_ACTIVE_GRANT",guessed.reason());

        UUID staff=UUID.randomUUID();
        Actor ownerActor=new Actor(ownerA,Set.of("ROLE_ADMIN"),Instant.now().minusSeconds(5));
        MembershipView invite=memberships.invite(ownerActor,clinicA,
            new CreateMembership(staff,MembershipRole.RECEPTIONIST,false,"synthetic staff"));
        Actor staffActor=new Actor(staff,Set.of("ROLE_RECEPTIONIST"),Instant.now().minusSeconds(4));
        memberships.activateOwnInvite(staffActor,invite.id());

        assertFalse(memberships.authorize(
            new AuthorizationRequest(staff,clinicA,branchA,Capability.RECEPTION)).allowed());

        MembershipView granted=memberships.grantBranch(ownerActor,clinicA,invite.id(),
            new GrantBranch(branchA,"assigned desk"));
        assertTrue(granted.version()>invite.version());
        assertTrue(memberships.authorize(
            new AuthorizationRequest(staff,clinicA,branchA,Capability.RECEPTION)).allowed());
        assertFalse(memberships.authorize(
            new AuthorizationRequest(staff,clinicB,branchB,Capability.RECEPTION)).allowed());

        MembershipView branchRevoked=memberships.revokeBranch(ownerActor,clinicA,invite.id(),branchA,
            new Reason("shift ended"));
        assertTrue(branchRevoked.version()>granted.version());
        assertFalse(memberships.authorize(
            new AuthorizationRequest(staff,clinicA,branchA,Capability.RECEPTION)).allowed());

        memberships.grantBranch(ownerActor,clinicA,invite.id(),new GrantBranch(branchA,"new shift"));
        memberships.revoke(ownerActor,clinicA,invite.id(),new Reason("staff removed"));
        assertFalse(memberships.authorize(
            new AuthorizationRequest(staff,clinicA,branchA,Capability.RECEPTION)).allowed());
        assertTrue(memberships.contextsForUser(staff).isEmpty());
    }

    @Test
    void selectedClinicRlsDoesNotLeakSameUsersOtherClinicRows() {
        UUID dual=UUID.randomUUID();
        Actor ownerAActor=new Actor(ownerA,Set.of("ROLE_ADMIN"),Instant.now());
        Actor ownerBActor=new Actor(ownerB,Set.of("ROLE_ADMIN"),Instant.now());

        MembershipView inviteA=memberships.invite(ownerAActor,clinicA,
            new CreateMembership(dual,MembershipRole.RECEPTIONIST,true,"dual clinic A"));
        memberships.activateOwnInvite(new Actor(dual,Set.of("ROLE_RECEPTIONIST"),Instant.now()),inviteA.id());

        MembershipView inviteB=memberships.invite(ownerBActor,clinicB,
            new CreateMembership(dual,MembershipRole.RECEPTIONIST,true,"dual clinic B"));
        memberships.activateOwnInvite(new Actor(dual,Set.of("ROLE_RECEPTIONIST"),Instant.now()),inviteB.id());

        Integer visibleInA=new TransactionTemplate(txManager).execute(status -> {
            scope.userAndClinic(dual,clinicA);
            return jdbc.queryForObject(
                "select count(*) from iam.memberships where user_id=?",Integer.class,dual);
        });
        assertEquals(1,visibleInA);

        Integer visibleInB=new TransactionTemplate(txManager).execute(status -> {
            scope.userAndClinic(dual,clinicB);
            return jdbc.queryForObject(
                "select count(*) from iam.memberships where user_id=?",Integer.class,dual);
        });
        assertEquals(1,visibleInB);
    }

    @Test
    void sessionCutoffRejectsOldTokenAndAllowsNewToken() {
        Instant issued=Instant.now().minusSeconds(30);
        Actor oldToken=new Actor(ownerA,Set.of("ROLE_ADMIN"),issued);
        assertTrue(sessions.accessAllowed(oldToken));

        Instant cutoff=Instant.now().minusSeconds(1);
        sessions.revokeBefore(ownerA,cutoff);
        assertFalse(sessions.accessAllowed(oldToken));
        assertTrue(sessions.accessAllowed(
            new Actor(ownerA,Set.of("ROLE_ADMIN"),cutoff.plusSeconds(1))));
    }

    @Test
    void branchScopedManagerCannotAcquireClinicWideManagementWithoutBranch() {
        UUID manager=UUID.randomUUID();
        Actor ownerActor=new Actor(ownerA,Set.of("ROLE_ADMIN"),Instant.now());
        MembershipView invite=memberships.invite(ownerActor,clinicA,
            new CreateMembership(manager,MembershipRole.CLINIC_MANAGER,false,"branch manager"));
        memberships.activateOwnInvite(new Actor(manager,Set.of("ROLE_ADMIN"),Instant.now()),invite.id());
        memberships.grantBranch(ownerActor,clinicA,invite.id(),new GrantBranch(branchA,"branch A"));

        assertFalse(memberships.authorize(
            new AuthorizationRequest(manager,clinicA,null,Capability.CLINIC_CONFIG)).allowed());
        assertTrue(memberships.authorize(
            new AuthorizationRequest(manager,clinicA,branchA,Capability.CLINIC_CONFIG)).allowed());
        assertFalse(memberships.authorize(
            new AuthorizationRequest(manager,clinicA,branchB,Capability.CLINIC_CONFIG)).allowed());
    }
}
