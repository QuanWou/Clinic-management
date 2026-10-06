package com.clinic.catalog;

import com.clinic.catalog.api.CatalogDto.*;
import com.clinic.catalog.repo.*;
import com.clinic.catalog.security.*;
import com.clinic.catalog.service.CatalogService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.*;
import java.sql.DriverManager;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@EnabledIfSystemProperty(named="catalog.it.enabled",matches="true")
@SpringBootTest(properties={
    "catalog.security.iam-url=http://127.0.0.1:1",
    "catalog.security.iam-service-secret=synthetic-catalog-to-iam-secret-more-than-32-bytes",
    "catalog.security.clinic-url=http://127.0.0.1:1",
    "catalog.security.clinic-service-secret=synthetic-catalog-to-clinic-secret-more-than-32-bytes"
})
class CatalogExternalPostgresTest {
    @DynamicPropertySource
    static void db(DynamicPropertyRegistry registry){
        String url=System.getProperty("catalog.it.jdbc-url","");
        if(!url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/clinic_v2_s004_catalog_sandbox"))
            throw new IllegalStateException("S0-04 Catalog test refuses non-disposable DB: "+url);
        registry.add("spring.datasource.url",()->url);
        String runtimeUser=setting("catalog.it.runtime-user","CATALOG_IT_RUNTIME_USER");
        String runtimePassword=setting("catalog.it.runtime-password","CATALOG_IT_RUNTIME_PASSWORD");
        if(Boolean.getBoolean("catalog.it.migrate")){
            if(runtimeUser==null||!runtimeUser.matches("[a-z][a-z0-9_]{0,62}"))
                throw new IllegalStateException("Invalid disposable runtime login");
            String migrationUser=System.getenv("CATALOG_IT_MIGRATION_USER");
            String migrationPassword=System.getenv("CATALOG_IT_MIGRATION_PASSWORD");
            if(migrationUser==null||migrationPassword==null)
                throw new IllegalStateException("Explicit migration credentials are required");
            Flyway.configure().dataSource(url,migrationUser,migrationPassword)
                .schemas("catalog_v2").defaultSchema("catalog_v2").locations("classpath:/modules/catalog/db/migration").load().migrate();
            try(var connection=DriverManager.getConnection(url,migrationUser,migrationPassword);
                var statement=connection.createStatement()){
                statement.execute("GRANT clinic_v2_catalog_runtime TO "+runtimeUser);
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

    @Autowired CatalogService service;
    @Autowired TenantDbContext db;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager tx;

    @MockBean IamAuthorizationClient iam;
    @MockBean ClinicDirectoryClient clinicDirectory;

    UUID manager,clinicA,clinicB,branchA,branchB;
    Actor actor;

    @BeforeEach void fixture(){
        manager=UUID.randomUUID();clinicA=UUID.randomUUID();clinicB=UUID.randomUUID();
        branchA=UUID.randomUUID();branchB=UUID.randomUUID();actor=new Actor(manager,Set.of("ROLE_ADMIN"));
        lenient().when(iam.decide(eq(manager),anyString(),any(),any()))
            .thenAnswer(inv->new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"ADMIN",1,"ALLOWED"));
    }

    OfferingView createOffering(UUID clinic,String code){
        return service.createOffering(actor,clinic,new OfferingInput(code,code+" Service",null,"GEN",true));
    }

    BranchOfferingView assign(UUID clinic,UUID branch,UUID offering){
        return service.assignToBranch(actor,clinic,branch,new BranchOfferingInput(offering,30,true,true));
    }

    @Test void appendOnlyPriceVersionsKeepHistoricalSnapshotStable(){
        OfferingView o=createOffering(clinicA,"CONSULT");
        assign(clinicA,branchA,o.id());
        Instant jan=Instant.parse("2026-01-01T00:00:00Z");
        Instant oct=Instant.parse("2026-10-01T00:00:00Z");

        PriceVersionView old=service.createPriceVersion(actor,clinicA,branchA,
            new PriceVersionInput(o.id(),100000,jan,null,null));
        PriceVersionView next=service.createPriceVersion(actor,clinicA,branchA,
            new PriceVersionInput(o.id(),120000,oct,null,null));

        PriceSnapshot september=service.snapshot(actor,clinicA,branchA,o.id(),Instant.parse("2026-09-15T00:00:00Z"));
        PriceSnapshot november=service.snapshot(actor,clinicA,branchA,o.id(),Instant.parse("2026-11-15T00:00:00Z"));
        assertEquals(old.id(),september.priceVersionId());
        assertEquals(100000,september.amountVnd());
        assertEquals(next.id(),november.priceVersionId());
        assertEquals(120000,november.amountVnd());

        assertThrows(DataAccessException.class,()->new TransactionTemplate(tx).executeWithoutResult(status->{
            db.tenant(clinicA);
            jdbc.update("update catalog_v2.price_versions set amount_vnd=1 where id=?",old.id());
        }));
        assertThrows(DataAccessException.class,()->new TransactionTemplate(tx).executeWithoutResult(status->{
            db.tenant(clinicA);
            jdbc.update("delete from catalog_v2.price_versions where id=?",old.id());
        }));
        assertEquals(100000,service.snapshot(actor,clinicA,branchA,o.id(),
            Instant.parse("2026-09-15T00:00:00Z")).amountVnd());
    }

    @Test void rlsKeepsCatalogRowsInsideSelectedClinic(){
        OfferingView a=createOffering(clinicA,"A-CONSULT");
        OfferingView b=createOffering(clinicB,"B-CONSULT");
        assign(clinicA,branchA,a.id());
        assign(clinicB,branchB,b.id());

        assertEquals(0,jdbc.queryForObject("select count(*) from catalog_v2.offerings",Integer.class));
        Map<String,Object> role=jdbc.queryForMap("select rolsuper,rolbypassrls from pg_roles where rolname=current_user");
        assertEquals(Boolean.FALSE,role.get("rolsuper"));
        assertEquals(Boolean.FALSE,role.get("rolbypassrls"));

        Integer countA=new TransactionTemplate(tx).execute(status->{
            db.tenant(clinicA);
            return jdbc.queryForObject("select count(*) from catalog_v2.offerings",Integer.class);
        });
        Integer countB=new TransactionTemplate(tx).execute(status->{
            db.tenant(clinicB);
            return jdbc.queryForObject("select count(*) from catalog_v2.offerings",Integer.class);
        });
        assertEquals(1,countA);
        assertEquals(1,countB);
        assertEquals(0,jdbc.queryForObject("select count(*) from catalog_v2.offerings",Integer.class));
        assertEquals(3,jdbc.queryForObject("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace "+
            "where n.nspname='catalog_v2' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity",Integer.class));
        Integer hiddenB=new TransactionTemplate(tx).execute(status->{
            db.tenant(clinicA);
            return jdbc.queryForObject("select count(*) from catalog_v2.offerings where id=?",Integer.class,b.id());
        });
        assertEquals(0,hiddenB);
        assertThrows(DataAccessException.class,()->new TransactionTemplate(tx).executeWithoutResult(status->{
            db.tenant(clinicA);
            jdbc.update("insert into catalog_v2.offerings(id,clinic_id,code,name) values(?,?,?,?)",
                UUID.randomUUID(),clinicB,"FORGED","Synthetic forbidden offering");
        }));
    }

    @Test void branchPricesStayIndependentAndFuturePriceDoesNotReplacePastPrice(){
        OfferingView o=createOffering(clinicA,"BRANCH-PRICE");
        assign(clinicA,branchA,o.id());
        assign(clinicA,branchB,o.id());
        Instant start=Instant.parse("2026-01-01T00:00:00Z");
        Instant change=Instant.parse("2026-10-01T00:00:00Z");
        service.createPriceVersion(actor,clinicA,branchA,new PriceVersionInput(o.id(),100000,start,null,null));
        var b=service.createPriceVersion(actor,clinicA,branchB,new PriceVersionInput(o.id(),200000,start,null,null));
        var original=service.snapshot(actor,clinicA,branchA,o.id(),start);
        service.createPriceVersion(actor,clinicA,branchA,new PriceVersionInput(o.id(),120000,change,null,null));
        assertEquals(100000,original.amountVnd());
        assertEquals(original.priceVersionId(),service.snapshot(actor,clinicA,branchA,o.id(),start).priceVersionId());
        assertEquals(120000,service.snapshot(actor,clinicA,branchA,o.id(),change).amountVnd());
        assertEquals(b.id(),service.snapshot(actor,clinicA,branchB,o.id(),change).priceVersionId());
        assertEquals(200000,service.snapshot(actor,clinicA,branchB,o.id(),change).amountVnd());
        assertThrows(com.clinic.catalog.api.ApiProblem.class,
            ()->service.snapshot(actor,clinicA,branchA,o.id(),start.minusSeconds(1)));
    }

    @Test void deniedIamScopeNeverSetsTenantOrChangesAnotherClinic(){
        OfferingView b=createOffering(clinicB,"B-DENIED");
        when(iam.decide(manager,"CATALOG_MANAGE",clinicB,null))
            .thenReturn(new IamAuthorizationClient.Decision(false,null,null,0,"NO_ACTIVE_GRANT"));
        assertThrows(com.clinic.catalog.api.ApiProblem.class,()->service.updateOffering(actor,clinicB,b.id(),
            new OfferingUpdate(b.version(),"Forbidden",null,"GEN",true)));
        assertEquals("B-DENIED Service",service.listOfferings(actor,clinicB).get(0).name());
        assertEquals(0,jdbc.queryForObject("select count(*) from catalog_v2.offerings",Integer.class));
    }

    @Test void duplicatePriceAtSameEffectiveInstantIsRejected(){
        OfferingView o=createOffering(clinicA,"LAB-CBC");
        assign(clinicA,branchA,o.id());
        Instant start=Instant.parse("2026-10-01T00:00:00Z");
        service.createPriceVersion(actor,clinicA,branchA,new PriceVersionInput(o.id(),80000,start,null,null));
        assertThrows(DataAccessException.class,()->service.createPriceVersion(actor,clinicA,branchA,
            new PriceVersionInput(o.id(),90000,start,null,null)));
    }
}
