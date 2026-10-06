package com.clinic.clinic;
import com.clinic.clinic.api.*;
import com.clinic.clinic.api.ClinicDto.*;
import com.clinic.clinic.security.*;
import com.clinic.clinic.service.ClinicOnboardingService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
@SpringBootTest(properties={"clinic.security.iam-service-secret=synthetic-clinic-to-iam-secret-more-than-32-bytes","clinic.security.iam-directory-secret=synthetic-iam-to-clinic-secret-more-than-32-bytes"})
@EnabledIfSystemProperty(named="clinic.it.enabled",matches="true")
class ClinicConfigurationPostgresTest {
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired ClinicOnboardingService service;@Autowired JdbcTemplate jdbc;@MockBean IamAuthorizationClient iam;
 @Test void creatorRecoversPrivateDraftWhileOrdinaryStaffAndStrangersCannotListIt(){
  var owner=new Actor(UUID.randomUUID(),Set.of("ROLE_USER"));var staff=new Actor(UUID.randomUUID(),Set.of("ROLE_ADMIN"));var stranger=new Actor(UUID.randomUUID(),Set.of("ROLE_USER"));
  var c=service.create(owner,new DraftInput("Synthetic configuration","config-"+UUID.randomUUID(),null,"Synthetic contact","private@example.invalid","000PRIVATE",new LicenseInput("PRIVATE-LICENSE","Synthetic authority","Synthetic scope","private/evidence",LocalDate.now().plusYears(1))));
  when(iam.contexts(owner.id())).thenReturn(List.of());
  var result=service.mine(owner);assertEquals(1,result.size());assertEquals(c.id(),result.getFirst().id());assertEquals("private/evidence",result.getFirst().license().evidenceRef());
  when(iam.contexts(staff.id())).thenReturn(List.of(new IamAuthorizationClient.ContextResult(UUID.randomUUID(),c.id(),"STAFF",true,List.of(),0)));
  assertTrue(service.mine(staff).isEmpty());assertTrue(service.mine(stranger).isEmpty());assertThrows(ApiProblem.class,()->service.owned(staff,c.id()));
  assertEquals(0,jdbc.queryForObject("select count(*) from clinic.clinics",Integer.class));assertEquals(0,jdbc.queryForObject("select count(*) from clinic.clinic_licenses",Integer.class));
 }
 @Test void staleProfileAndBranchEditsAreRejectedAndResponsesContainCommittedVersions(){
  var owner=new Actor(UUID.randomUUID(),Set.of("ROLE_USER"));var c=service.create(owner,new DraftInput("Synthetic before","version-"+UUID.randomUUID(),null,null,null,null,null));
  when(iam.allowed(owner.id(),"CLINIC_CONFIG",c.id(),null)).thenReturn(true);
  var changed=service.update(owner,c.id(),new DraftInput("Synthetic after",c.slug(),null,null,null,null,null,c.version()));
  assertTrue(changed.version()>c.version());assertEquals(changed.version(),service.owned(owner,c.id()).version());
  assertThrows(ApiProblem.class,()->service.update(owner,c.id(),new DraftInput("Stale overwrite",c.slug(),null,null,null,null,null,c.version())));
  assertThrows(ApiProblem.class,()->service.addBranch(owner,c.id(),new BranchInput("Stale branch","Synthetic address","08-17",true,c.version())));
  var withBranch=service.addBranch(owner,c.id(),new BranchInput("Synthetic branch","Synthetic address","08-17",true,changed.version()));
  assertTrue(withBranch.version()>changed.version());assertEquals(1,withBranch.branches().size());assertEquals("Synthetic after",withBranch.name());
  assertEquals(0,jdbc.queryForObject("select count(*) from clinic.clinics",Integer.class));
 }
}
