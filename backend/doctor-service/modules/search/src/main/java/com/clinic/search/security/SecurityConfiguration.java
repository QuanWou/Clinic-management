package com.clinic.search.security;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfiguration{
  @Bean FilterRegistrationBean<WorkloadFilter> registration(WorkloadFilter f){var r=new FilterRegistrationBean<>(f);r.setEnabled(false);return r;}
  @Bean SecurityFilterChain chain(HttpSecurity http,WorkloadFilter f)throws Exception{
    return http.csrf(c->c.disable()).sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .authorizeHttpRequests(a->a.requestMatchers("/actuator/health/**","/api/public/**").permitAll()
        .requestMatchers("/api/internal/**").hasAuthority("SCOPE_search.project")
        .anyRequest().denyAll())
      .addFilterBefore(f,UsernamePasswordAuthenticationFilter.class).build();
  }
}
