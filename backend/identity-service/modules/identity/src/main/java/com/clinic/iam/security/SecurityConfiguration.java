package com.clinic.iam.security;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
@Configuration
public class SecurityConfiguration {
 @Bean FilterRegistrationBean<UserAuthenticationFilter> userRegistration(UserAuthenticationFilter f){var r=new FilterRegistrationBean<>(f);r.setEnabled(false);return r;}
 @Bean FilterRegistrationBean<WorkloadAuthenticationFilter> workloadRegistration(WorkloadAuthenticationFilter f){var r=new FilterRegistrationBean<>(f);r.setEnabled(false);return r;}
 @Bean SecurityFilterChain chain(HttpSecurity http,UserAuthenticationFilter user,WorkloadAuthenticationFilter workload)throws Exception{
  return http.csrf(c->c.disable()).sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
   .authorizeHttpRequests(a->a.requestMatchers("/actuator/health/**").permitAll().requestMatchers("/api/internal/**").hasRole("SERVICE").anyRequest().authenticated())
   .addFilterBefore(workload,UsernamePasswordAuthenticationFilter.class)
   .addFilterAfter(user,WorkloadAuthenticationFilter.class).build();
 }
}
