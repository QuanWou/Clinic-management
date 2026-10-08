package com.clinic.identity.controller;

import com.clinic.identity.entity.*;
import com.clinic.identity.repository.UserRepository;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Pageable;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/** Compile the actual repository HQL against entity mappings without a database connection. */
class PatientAccountQueryTest {
    @Test void patientDirectoryQueryCompilesWithStatusAndEscapedSearch() throws Exception {
        var registry=new StandardServiceRegistryBuilder()
            .applySetting("hibernate.dialect","org.hibernate.dialect.PostgreSQLDialect")
            .applySetting("hibernate.boot.allow_jdbc_metadata_access",false)
            .applySetting("hibernate.hbm2ddl.auto","none").build();
        try(var factory=new MetadataSources(registry).addAnnotatedClass(User.class).addAnnotatedClass(Role.class)
                .buildMetadata().buildSessionFactory();var session=factory.openSession()) {
            String hql=UserRepository.class.getMethod("findPatientAccounts",List.class,UserStatus.class,String.class,Pageable.class)
                .getAnnotation(Query.class).value();
            var query=session.createQuery(hql,User.class);
            assertNotNull(query.getParameter("status"));assertNotNull(query.getParameter("excluded"));assertNotNull(query.getParameter("query"));
        } finally {StandardServiceRegistryBuilder.destroy(registry);}
    }
}
