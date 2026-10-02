package com.clinic.v2.iam.security;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import java.util.UUID;
@Component
public class DatabaseScope {
 private final JdbcTemplate jdbc;
 public DatabaseScope(JdbcTemplate jdbc){this.jdbc=jdbc;}
 public void user(UUID userId){
  jdbc.queryForObject("select set_config('app.user_id', ?, true)",String.class,userId.toString());
  jdbc.queryForObject("select set_config('app.clinic_id', '', true)",String.class);
 }
 public void userAndClinic(UUID userId,UUID clinicId){
  jdbc.queryForObject("select set_config('app.user_id', ?, true)",String.class,userId.toString());
  jdbc.queryForObject("select set_config('app.clinic_id', ?, true)",String.class,clinicId.toString());
 }
 public void clear(){
  jdbc.queryForObject("select set_config('app.user_id', '', true)",String.class);
  jdbc.queryForObject("select set_config('app.clinic_id', '', true)",String.class);
 }
}
