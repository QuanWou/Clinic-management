package com.clinic.v2.encounter.security;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import java.util.UUID;
@Component
public class EncounterDb {
 private final JdbcTemplate jdbc;
 public EncounterDb(JdbcTemplate jdbc){this.jdbc=jdbc;}
 public void scope(UUID clinic,UUID branch){jdbc.queryForObject("select set_config('app.clinic_id',?,true)",String.class,clinic.toString());jdbc.queryForObject("select set_config('app.branch_id',?,true)",String.class,branch.toString());}
 public void lock(String name){jdbc.queryForObject("select pg_advisory_xact_lock(hashtextextended(?,0))",Object.class,name);}
}
