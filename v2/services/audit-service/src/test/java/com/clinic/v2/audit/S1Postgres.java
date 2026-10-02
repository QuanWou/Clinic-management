package com.clinic.v2.audit;

import org.flywaydb.core.Flyway;
import org.springframework.test.context.DynamicPropertyRegistry;
import java.sql.DriverManager;

final class S1Postgres {
 static void configure(DynamicPropertyRegistry registry){
  String url=System.getProperty("audit.it.jdbc-url","");
  if(!url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/clinic_v2_s1_audit_sandbox"))
   throw new IllegalStateException("Integration test refuses non-disposable database");
  String migrator=System.getenv("AUDIT_IT_MIGRATION_USER");
  String migrationPassword=System.getenv("AUDIT_IT_MIGRATION_PASSWORD");
  String runtime=System.getenv("AUDIT_IT_RUNTIME_USER");
  if(runtime==null||!runtime.matches("[a-z][a-z0-9_]{0,62}"))throw new IllegalStateException("Missing isolated runtime");
  Flyway.configure().dataSource(url,migrator,migrationPassword).schemas("audit_v2").defaultSchema("audit_v2").load().migrate();
  try(var connection=DriverManager.getConnection(url,migrator,migrationPassword);var statement=connection.createStatement()){
   statement.execute("GRANT clinic_v2_audit_runtime TO "+runtime);
  }catch(java.sql.SQLException ex){throw new IllegalStateException(ex);}
  registry.add("spring.datasource.url",()->url);
  registry.add("spring.datasource.username",()->runtime);
  registry.add("spring.datasource.password",()->System.getenv("AUDIT_IT_RUNTIME_PASSWORD"));
  registry.add("spring.flyway.enabled",()->false);
 }
}
