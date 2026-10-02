package com.clinic.v2.doctor;

import com.clinic.v2.doctor.api.DoctorDto.*;
import com.clinic.v2.doctor.domain.*;
import com.clinic.v2.doctor.repo.*;
import com.clinic.v2.doctor.security.*;
import com.clinic.v2.doctor.service.DoctorService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.*;
import java.util.*;
import java.sql.DriverManager;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@EnabledIfSystemProperty(named="doctor.it.enabled",matches="true")
@SpringBootTest(properties={
    "doctor.security.iam-url=http://127.0.0.1:1",
    "doctor.security.iam-service-secret=synthetic-doctor-to-iam-secret-more-than-32-bytes",
    "doctor.security.clinic-url=http://127.0.0.1:1",
    "doctor.security.clinic-service-secret=synthetic-doctor-to-clinic-secret-more-than-32-bytes"
})
class DoctorExternalPostgresTest {
    @DynamicPropertySource
    static void db(DynamicPropertyRegistry registry){
        String url=System.getProperty("doctor.it.jdbc-url","");
        if(!url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/clinic_v2_s004_doctor_sandbox"))
            throw new IllegalStateException("S0-04 Doctor test refuses non-disposable DB: "+url);
        registry.add("spring.datasource.url",()->url);
        String runtimeUser=setting("doctor.it.runtime-user","DOCTOR_IT_RUNTIME_USER");
        String runtimePassword=setting("doctor.it.runtime-password","DOCTOR_IT_RUNTIME_PASSWORD");
        if(Boolean.getBoolean("doctor.it.migrate")){
            if(runtimeUser==null||!runtimeUser.matches("[a-z][a-z0-9_]{0,62}"))
                throw new IllegalStateException("Invalid disposable runtime login");
            String migrationUser=System.getenv("DOCTOR_IT_MIGRATION_USER");
            String migrationPassword=System.getenv("DOCTOR_IT_MIGRATION_PASSWORD");
            if(migrationUser==null||migrationPassword==null)
                throw new IllegalStateException("Explicit migration credentials are required");
            Flyway.configure().dataSource(url,migrationUser,migrationPassword)
                .schemas("doctor").defaultSchema("doctor").locations("classpath:db/migration").load().migrate();
            try(var connection=DriverManager.getConnection(url,migrationUser,migrationPassword);
                var statement=connection.createStatement()){
                statement.execute("GRANT clinic_v2_doctor_runtime TO "+runtimeUser);
            }catch(java.sql.SQLException ex){
                throw new IllegalStateException("Cannot grant the disposable runtime role",ex);
            }
        }
        registry.add("spring.datasource.username",()->runtimeUser);
        registry.add("spring.datasource.password",()->runtimePassword);
        registry.add("spring.flyway.enabled",()->"false");
    }

    private static String setting(String property,String environment){
        String value=System.getenv(environment);
        return value==null?System.getProperty(property):value;
    }

    @Autowired DoctorService service;
    @Autowired DoctorAffiliationRepository affiliations;
    @Autowired WorkingScheduleRepository schedules;
    @Autowired TenantDbContext db;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager tx;

    @MockBean IamAuthorizationClient iam;
    @MockBean ClinicDirectoryClient clinicDirectory;

    UUID manager,doctorUser,clinicA,clinicB,branchA,branchB;
    Actor actor;

    @BeforeEach void fixture(){
        manager=UUID.randomUUID();doctorUser=UUID.randomUUID();
        clinicA=UUID.randomUUID();clinicB=UUID.randomUUID();branchA=UUID.randomUUID();branchB=UUID.randomUUID();
        actor=new Actor(manager,Set.of("ROLE_ADMIN"));
        lenient().when(iam.decide(eq(manager),anyString(),any(),any()))
            .thenAnswer(inv->new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"CLINIC_MANAGER",1,"ALLOWED"));
        lenient().when(iam.decide(eq(doctorUser),eq("DOCTOR_WORK"),any(),any()))
            .thenAnswer(inv->new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"DOCTOR",1,"ALLOWED"));
    }

    AffiliationView affiliation(UUID clinic,UUID branch){
        return service.createAffiliation(actor,clinic,branch,
            new AffiliationInput(doctorUser,"Synthetic Doctor","SYN-REG","GEN","General",null,
                LocalDate.of(2026,1,1),null,false));
    }

    @Test void rlsAndScheduleIsolationKeepClinicAChangesOutOfClinicB(){
        AffiliationView a=affiliation(clinicA,branchA);
        AffiliationView b=affiliation(clinicB,branchB);

        ScheduleView sa=service.createSchedule(actor,clinicA,branchA,a.id(),
            new ScheduleInput(1,LocalTime.of(8,0),LocalTime.of(12,0),LocalDate.of(2026,1,1),null,null,true));
        ScheduleView sb=service.createSchedule(actor,clinicB,branchB,b.id(),
            new ScheduleInput(1,LocalTime.of(13,0),LocalTime.of(17,0),LocalDate.of(2026,1,1),null,null,true));

        service.updateSchedule(actor,clinicA,branchA,a.id(),sa.id(),
            new ScheduleUpdate(sa.version(),1,LocalTime.of(9,0),LocalTime.of(12,0),
                LocalDate.of(2026,1,1),null,"Asia/Ho_Chi_Minh",true));

        DoctorScheduleView viewB=service.schedules(actor,clinicB,branchB,b.id());
        assertEquals(1,viewB.schedules().size());
        assertEquals(LocalTime.of(13,0),viewB.schedules().get(0).startTime());

        assertEquals(0,jdbc.queryForObject("select count(*) from doctor.doctor_affiliations",Integer.class));
        Map<String,Object> role=jdbc.queryForMap("select rolsuper,rolbypassrls from pg_roles where rolname=current_user");
        assertEquals(Boolean.FALSE,role.get("rolsuper"));
        assertEquals(Boolean.FALSE,role.get("rolbypassrls"));

        Integer countA=new TransactionTemplate(tx).execute(status->{
            db.tenant(clinicA);
            return jdbc.queryForObject("select count(*) from doctor.doctor_affiliations",Integer.class);
        });
        Integer countB=new TransactionTemplate(tx).execute(status->{
            db.tenant(clinicB);
            return jdbc.queryForObject("select count(*) from doctor.doctor_affiliations",Integer.class);
        });
        assertEquals(1,countA);
        assertEquals(1,countB);
        assertEquals(0,jdbc.queryForObject("select count(*) from doctor.doctor_affiliations",Integer.class));
        assertEquals(2,jdbc.queryForObject("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace "+
            "where n.nspname='doctor' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity",Integer.class));
        assertThrows(DataIntegrityViolationException.class,()->new TransactionTemplate(tx).executeWithoutResult(status->{
            db.tenant(clinicA);
            jdbc.update("insert into doctor.working_schedules(id,affiliation_id,practitioner_id,clinic_id,branch_id,"+
                "day_of_week,start_minute,end_minute,effective_from) values(?,?,?,?,?,1,480,720,DATE '2026-01-01')",
                UUID.randomUUID(),b.id(),b.practitionerId(),clinicA,branchA);
        }));
        verify(clinicDirectory,times(3)).requireBranch(clinicA,branchA);
        verify(clinicDirectory,times(2)).requireBranch(clinicB,branchB);
    }

    @Test void overlappingRecurringScheduleIsRejectedByDatabase(){
        AffiliationView a=affiliation(clinicA,branchA);
        service.createSchedule(actor,clinicA,branchA,a.id(),
            new ScheduleInput(2,LocalTime.of(8,0),LocalTime.of(12,0),LocalDate.of(2026,1,1),null,null,true));

        assertThrows(DataIntegrityViolationException.class,()->service.createSchedule(actor,clinicA,branchA,a.id(),
            new ScheduleInput(2,LocalTime.of(11,0),LocalTime.of(14,0),LocalDate.of(2026,2,1),null,null,true)));
    }

    @Test void affiliationCannotChangePractitionerSharedWithAnotherClinic(){
        AffiliationView b=affiliation(clinicB,branchB);
        assertThrows(com.clinic.v2.doctor.api.ApiProblem.class,()->service.createAffiliation(actor,clinicA,branchA,
            new AffiliationInput(doctorUser,"Changed at clinic A","SYN-REG","GEN","General",null,
                LocalDate.of(2026,1,1),null,false)));
        assertEquals("Synthetic Doctor",service.listAffiliations(actor,clinicB,branchB).get(0).displayName());
        assertThrows(org.springframework.dao.DataAccessException.class,()->jdbc.update(
            "update doctor.practitioners set display_name='Forbidden global edit' where id=?",b.practitionerId()));
    }

    @Test void deniedManagerCannotEditScheduleInAnotherClinic(){
        AffiliationView b=affiliation(clinicB,branchB);
        ScheduleView s=service.createSchedule(actor,clinicB,branchB,b.id(),
            new ScheduleInput(1,LocalTime.of(8,0),LocalTime.of(12,0),LocalDate.of(2026,1,1),null,null,true));
        when(iam.decide(manager,"SCHEDULE_MANAGE",clinicB,branchB))
            .thenReturn(new IamAuthorizationClient.Decision(false,null,null,0,"NO_ACTIVE_GRANT"));
        assertThrows(com.clinic.v2.doctor.api.ApiProblem.class,()->service.updateSchedule(actor,clinicB,branchB,b.id(),s.id(),
            new ScheduleUpdate(s.version(),1,LocalTime.of(9,0),LocalTime.of(12,0),
                LocalDate.of(2026,1,1),null,null,true)));
        assertEquals(LocalTime.of(8,0),service.schedules(actor,clinicB,branchB,b.id()).schedules().get(0).startTime());
        assertEquals(0,jdbc.queryForObject("select count(*) from doctor.working_schedules",Integer.class));
    }
}
