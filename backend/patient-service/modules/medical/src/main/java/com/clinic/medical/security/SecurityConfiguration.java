package com.clinic.medical.security;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfiguration {
    @Bean FilterRegistrationBean<ApiAuthenticationFilter> registration(ApiAuthenticationFilter f){
        var r=new FilterRegistrationBean<>(f);r.setEnabled(false);return r;
    }
    @Bean SecurityFilterChain chain(HttpSecurity http,ApiAuthenticationFilter f)throws Exception{
        return http.csrf(c->c.disable()).sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a->a.dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ASYNC).permitAll().requestMatchers("/actuator/health/**","/api/public/**","/api/internal/clinics/*/branches/*/visits/*/billing-proof","/api/internal/clinics/*/branches/*/visits/*/billing-sync-proof","/api/internal/clinics/*/branches/*/orders/*/billing-sync-proof").permitAll().anyRequest().authenticated())
            .addFilterBefore(f,UsernamePasswordAuthenticationFilter.class).build();
    }
}

