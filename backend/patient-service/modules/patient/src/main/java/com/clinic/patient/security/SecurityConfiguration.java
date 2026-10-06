package com.clinic.patient.security;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
@Configuration
public class SecurityConfiguration{
 @Bean FilterRegistrationBean<UserAuthenticationFilter> userReg(UserAuthenticationFilter f){var r=new FilterRegistrationBean<>(f);r.setEnabled(false);return r;}
 @Bean FilterRegistrationBean<WorkloadAuthenticationFilter> workloadReg(WorkloadAuthenticationFilter f){var r=new FilterRegistrationBean<>(f);r.setEnabled(false);return r;}
 @Bean SecurityFilterChain chain(HttpSecurity http,UserAuthenticationFilter uf,WorkloadAuthenticationFilter wf)throws Exception{
  return http.csrf(c->c.disable()).sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
   .authorizeHttpRequests(a->a.requestMatchers("/actuator/health/**").permitAll().requestMatchers("/api/internal/notification-recipients/**").hasAuthority("SCOPE_patient.notification.recipient").requestMatchers("/api/internal/clinics/**").hasAuthority("SCOPE_patient.clinic.read").requestMatchers("/api/internal/**").hasAuthority("SCOPE_patient.booking.read").anyRequest().authenticated())
   .addFilterBefore(wf,UsernamePasswordAuthenticationFilter.class).addFilterAfter(uf,WorkloadAuthenticationFilter.class).build();
 }
}
