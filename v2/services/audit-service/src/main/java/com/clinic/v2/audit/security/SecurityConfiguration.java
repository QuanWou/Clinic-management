package com.clinic.v2.audit.security;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfiguration {
    @Bean FilterRegistrationBean<WorkloadAuthenticationFilter> registration(WorkloadAuthenticationFilter f){
        var r=new FilterRegistrationBean<>(f);r.setEnabled(false);return r;
    }

    @Bean SecurityFilterChain chain(HttpSecurity http,WorkloadAuthenticationFilter f)throws Exception{
        return http.csrf(c->c.disable())
            .sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a->a
                .requestMatchers("/actuator/health/**").permitAll()
                .requestMatchers(HttpMethod.POST,"/api/v2/internal/audit/events").hasAuthority("SCOPE_audit.write")
                .requestMatchers(HttpMethod.POST,"/api/v2/internal/audit/appointment-events").hasAuthority("SCOPE_audit.write")
                .requestMatchers(HttpMethod.POST,"/api/v2/internal/audit/encounter-events").hasAuthority("SCOPE_audit.write")
                .requestMatchers(HttpMethod.POST,"/api/v2/internal/audit/medical-events").hasAuthority("SCOPE_audit.write")
                .requestMatchers(HttpMethod.POST,"/api/v2/internal/audit/billing-events").hasAuthority("SCOPE_audit.write")
                .requestMatchers(HttpMethod.GET,"/api/v2/internal/audit/**").hasAuthority("SCOPE_audit.read")
                .requestMatchers(HttpMethod.POST,"/api/v2/internal/event-envelope/validate").hasAuthority("SCOPE_event.validate")
                .anyRequest().denyAll())
            .addFilterBefore(f,UsernamePasswordAuthenticationFilter.class).build();
    }
}
