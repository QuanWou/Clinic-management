package com.clinic.clinic;
import com.clinic.clinic.api.ApiProblem;
import com.clinic.clinic.security.*;
import com.clinic.clinic.service.PatientHistoryDirectory;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
@SpringBootTest(properties={"clinic.security.iam-service-secret=synthetic-clinic-to-iam-secret-more-than-32-bytes","clinic.security.iam-directory-secret=synthetic-iam-to-clinic-secret-more-than-32-bytes"})
@EnabledIfSystemProperty(named="clinic.it.enabled",matches="true")
class PatientHistoryPostgresTest {
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired PatientHistoryDirectory directory;@Autowired JdbcTemplate jdbc;@Autowired PlatformTransactionManager manager;@MockBean PatientHistoryClient patient;
 @Test void linkedUnpublishedClinicRemainsReadableWithoutExposingAnotherClinicOrPrivateContacts(){
  UUID c=UUID.randomUUID(),hidden=UUID.randomUUID(),b=UUID.randomUUID();var actor=new Actor(UUID.randomUUID(),Set.of("ROLE_USER"));
  new TransactionTemplate(manager).execute(t->{jdbc.execute("select set_config('app.access_mode','system',true)");for(UUID id:List.of(c,hidden))jdbc.update("insert into clinic.clinics(id,owner_user_id,slug,name,contact_phone,publication_status) values(?,?,?,?,?,'UNPUBLISHED')",id,UUID.randomUUID(),"synthetic-history-"+id,"Synthetic "+id,"000-PRIVATE");jdbc.update("insert into clinic.branches(id,clinic_id,name,address,opening_hours,active) values(?,?,?,?,?,false)",b,c,"Synthetic retired branch","Private address","08-17");return null;});
  when(patient.clinics("Bearer synthetic-patient")).thenAnswer(i->{assertFalse(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive());return List.of(c);});
  var result=directory.own(actor,"Bearer synthetic-patient");assertEquals(1,result.size());assertEquals(c,result.getFirst().clinicId());assertEquals(b,result.getFirst().branches().getFirst().branchId());assertFalse(result.getFirst().branches().getFirst().active());assertFalse(result.toString().contains("000-PRIVATE"));assertFalse(result.toString().contains("Private address"));
  assertEquals(0,jdbc.queryForObject("select count(*) from clinic.clinics",Integer.class));when(patient.clinics("Bearer synthetic-patient")).thenThrow(ApiProblem.forbidden());assertThrows(ApiProblem.class,()->directory.own(actor,"Bearer synthetic-patient"));
 }
}
