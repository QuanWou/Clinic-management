package com.clinic.v2.iam;

import com.clinic.v2.iam.api.ApiProblem;
import com.clinic.v2.iam.api.IamDto.*;
import com.clinic.v2.iam.client.ClinicDirectoryClient;
import com.clinic.v2.iam.domain.*;
import com.clinic.v2.iam.repo.*;
import com.clinic.v2.iam.security.*;
import com.clinic.v2.iam.service.MembershipService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@EnabledIfSystemProperty(named="iam.it.enabled",matches="true")
@SpringBootTest(properties={
 "iam.security.jwt-secret=synthetic-user-jwt-secret-more-than-32-bytes",
 "iam.security.clinic-service-secret=synthetic-clinic-caller-secret-more-than-32-bytes",
 "iam.security.clinic-directory-secret=synthetic-iam-directory-secret-more-than-32-bytes",
 "iam.security.bootstrap-secret=synthetic-bootstrap-secret-more-than-32-bytes"
})
class IamExternalPostgresTest {
 static final UUID A=UUID.fromString("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
 static final UUID B=UUID.fromString("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
 static final UUID A1=UUID.fromString("aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa");
 static final UUID A2=UUID.fromString("aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa");
 static final UUID B1=UUID.fromString("bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb");
 static final UUID OA=UUID.fromString("11111111-1111-4111-8111-111111111111");
 static final UUID OB=UUID.fromString("22222222-2222-4222-8222-222222222222");
 static final UUID STAFF=UUID.fromString("33333333-3333-4333-8333-333333333333");
 static final UUID PLATFORM=UUID.fromString("44444444-4444-4444-8444-444444444444");

 @DynamicPropertySource static void db(DynamicPropertyRegistry r){
   String url=System.getProperty("iam.it.jdbc-url","");
   if(!url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/clinic_v2_s003_iam_sandbox"))
     throw new IllegalStateException("S0-03 IAM test refuses non-disposable DB: "+url);
   r.add("spring.datasource.url",()->url);
   r.add("spring.datasource.username",()->System.getProperty("iam.it.user"));
   r.add("spring.datasource.password",()->System.getProperty("iam.it.password"));
 }

 @Autowired MembershipService service;
 @Autowired MembershipRepository memberships;
 @Autowired BranchGrantRepository branchGrants;
 @Autowired PlatformGrantRepository platformGrants;
 @Autowired PermissionEpochRepository epochs;
 @Autowired SecurityEventRepository events;
 @MockBean ClinicDirectoryClient clinicDirectory;
 @MockBean LegacyIdentityClient legacyIdentity;

 final Actor ownerA=new Actor(OA,Set.of("ROLE_ADMIN"),Instant.now().minusSeconds(1));
 final Actor ownerB=new Actor(OB,Set.of("ROLE_DOCTOR"),Instant.now().minusSeconds(1));
 final Actor staff=new Actor(STAFF,Set.of("ROLE_DOCTOR"),Instant.now().minusSeconds(1));

 @BeforeEach void setup(){
   events.deleteAll();branchGrants.deleteAll();memberships.deleteAll();platformGrants.deleteAll();epochs.deleteAll();
   lenient().when(clinicDirectory.clinicScope(eq(A),any())).thenReturn(new ClinicDirectoryClient.Scope(A,OA,true,Set.of(A1,A2)));
   lenient().when(clinicDirectory.clinicScope(eq(B),any())).thenReturn(new ClinicDirectoryClient.Scope(B,OB,true,Set.of(B1)));
   service.claimPrimaryOwner(ownerA,A);
   service.claimPrimaryOwner(ownerB,B);
 }

 @Test void membershipIsTenantAndBranchScopedAndSwitchRequiresSecondGrant(){
   var grant=service.create(ownerA,new MembershipInput(STAFF,A,MembershipRole.DOCTOR,false,Set.of(A1),"assign A1"));
   assertEquals(Set.of(A1),grant.branchIds());
   assertTrue(service.resolve(staff,A,A1).roles().contains(MembershipRole.DOCTOR));
   assertThrows(ApiProblem.class,()->service.resolve(staff,A,A2));
   assertThrows(ApiProblem.class,()->service.resolve(staff,B,B1));

   service.create(ownerB,new MembershipInput(STAFF,B,MembershipRole.DOCTOR,true,Set.of(),"also B"));
   assertEquals(B,service.resolve(staff,B,B1).clinicId());
   assertEquals(2,service.contexts(staff).size());
 }

 @Test void revokeBlocksNextResolutionAndBumpsEpoch(){
   MembershipView grant=service.create(ownerA,new MembershipInput(STAFF,A,MembershipRole.RECEPTIONIST,false,Set.of(A1),"front desk"));
   long before=service.resolve(staff,A,A1).permissionVersion();
   service.revoke(ownerA,grant.id(),new RevokeInput("employment ended"));
   assertThrows(ApiProblem.class,()->service.resolve(staff,A,A1));
   assertTrue(epochs.findById(STAFF).orElseThrow().epoch>before);
 }

 @Test void ownerCannotAdminOtherClinic(){
   assertThrows(ApiProblem.class,()->service.create(ownerA,
      new MembershipInput(STAFF,B,MembershipRole.NURSE,true,Set.of(),"cross tenant")));
 }

 @Test void platformGrantIsIndependentAndRevocable(){
   assertFalse(service.authorizeInternal(new AuthorizationRequest(PLATFORM,null,null,"PLATFORM_CLINIC_REVIEW")).allowed());
   service.grantPlatform("platform-bootstrap",new PlatformGrantInput(PLATFORM,PlatformCapability.PLATFORM_CLINIC_REVIEW,"approved"));
   assertTrue(service.authorizeInternal(new AuthorizationRequest(PLATFORM,null,null,"PLATFORM_CLINIC_REVIEW")).allowed());
   service.revokePlatform("platform-bootstrap",new PlatformGrantInput(PLATFORM,PlatformCapability.PLATFORM_CLINIC_REVIEW,"removed"));
   assertFalse(service.authorizeInternal(new AuthorizationRequest(PLATFORM,null,null,"PLATFORM_CLINIC_REVIEW")).allowed());
 }

 @Test void ownerClaimIsIdempotent(){
   long before=epochs.findById(OA).orElseThrow().epoch;
   service.claimPrimaryOwner(ownerA,A);
   assertEquals(before,epochs.findById(OA).orElseThrow().epoch);
   assertEquals(1,memberships.findByUserIdAndStatusOrderByClinicIdAscRoleAsc(OA,MembershipStatus.ACTIVE).size());
 }
}
