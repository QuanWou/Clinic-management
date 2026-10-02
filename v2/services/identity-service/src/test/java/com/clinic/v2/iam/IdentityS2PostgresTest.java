package com.clinic.v2.iam;
import com.clinic.v2.iam.api.*;
import com.clinic.v2.iam.api.IamDto.*;
import com.clinic.v2.iam.domain.*;
import com.clinic.v2.iam.security.*;
import com.clinic.v2.iam.service.MembershipService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
@SpringBootTest(properties={"iam.security.jwt-secret=synthetic-s2-user-secret-at-least-32-bytes","iam.security.workload-inbound-secret=synthetic-s2-iam-secret-at-least-32-bytes","iam.clinic.workload-outbound-secret=synthetic-s2-clinic-secret-at-least-32-bytes"})
@EnabledIfSystemProperty(named="identity.it.enabled",matches="true")
class IdentityS2PostgresTest {
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired MembershipService service;@Autowired JdbcTemplate jdbc;@MockBean ClinicDirectoryClient clinic;
 @Test void receptionScopeAndRevocationStayCanonicalAndFailClosed(){
  UUID owner=UUID.randomUUID(),staff=UUID.randomUUID(),clinicId=UUID.randomUUID(),branch=UUID.randomUUID();
  when(clinic.clinicOwnedBy(clinicId,owner)).thenReturn(true);when(clinic.clinicExists(clinicId)).thenReturn(true);when(clinic.branchExists(clinicId,branch)).thenReturn(true);
  service.bootstrapOwner(clinicId,owner);var ownerActor=new Actor(owner,Set.of("ROLE_USER"),Instant.now());
  var membership=service.invite(ownerActor,clinicId,new CreateMembership(staff,MembershipRole.RECEPTIONIST,false,"Synthetic receptionist"));service.activateOwnInvite(new Actor(staff,Set.of("ROLE_USER"),Instant.now()),membership.id());
  assertFalse(service.authorize(new AuthorizationRequest(staff,clinicId,branch,Capability.RECEPTION)).allowed());service.grantBranch(ownerActor,clinicId,membership.id(),new GrantBranch(branch,"Synthetic grant"));
  assertTrue(service.authorize(new AuthorizationRequest(staff,clinicId,branch,Capability.RECEPTION)).allowed());assertFalse(service.authorize(new AuthorizationRequest(staff,clinicId,UUID.randomUUID(),Capability.RECEPTION)).allowed());assertFalse(service.authorize(new AuthorizationRequest(staff,clinicId,branch,Capability.DOCTOR_WORK)).allowed());
  service.revoke(ownerActor,clinicId,membership.id(),new Reason("Synthetic revoke"));assertFalse(service.authorize(new AuthorizationRequest(staff,clinicId,branch,Capability.RECEPTION)).allowed());
  assertEquals(0,jdbc.queryForObject("select count(*) from iam.memberships",Integer.class));
 }
 @Test void ownInvitationDiscoveryDoesNotExposeOtherUsersOrGrantActiveAccess(){
  UUID owner=UUID.randomUUID(),staff=UUID.randomUUID(),stranger=UUID.randomUUID(),clinicId=UUID.randomUUID();
  when(clinic.clinicOwnedBy(clinicId,owner)).thenReturn(true);when(clinic.clinicExists(clinicId)).thenReturn(true);
  service.bootstrapOwner(clinicId,owner);var ownerActor=new Actor(owner,Set.of("ROLE_USER"),Instant.now());
  var invited=service.invite(ownerActor,clinicId,new CreateMembership(staff,MembershipRole.DOCTOR,true,"Synthetic invite"));
  service.invite(ownerActor,clinicId,new CreateMembership(stranger,MembershipRole.LAB,true,"Synthetic other invite"));
  var actor=new Actor(staff,Set.of("ROLE_USER"),Instant.now());
  var list=service.ownInvitations(actor);assertEquals(1,list.size());assertEquals(invited.id(),list.getFirst().id());
  assertTrue(service.contexts(actor).isEmpty());assertFalse(service.authorize(new AuthorizationRequest(staff,clinicId,UUID.randomUUID(),Capability.DOCTOR_WORK)).allowed());
  assertThrows(ApiProblem.class,()->service.activateOwnInvite(new Actor(stranger,Set.of("ROLE_USER"),Instant.now()),invited.id()));
  service.activateOwnInvite(actor,invited.id());assertTrue(service.ownInvitations(actor).isEmpty());assertEquals(1,service.contexts(actor).size());
  assertEquals(0,jdbc.queryForObject("select count(*) from iam.memberships",Integer.class));
 }
}
