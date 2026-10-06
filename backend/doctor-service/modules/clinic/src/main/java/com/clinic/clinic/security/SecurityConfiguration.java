package com.clinic.clinic.security;
import org.springframework.context.annotation.*;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.*;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;

@Configuration @EnableWebSecurity
public class SecurityConfiguration {
    @Bean FilterRegistrationBean<ApiAuthenticationFilter> securityOnlyRegistration(ApiAuthenticationFilter filter) {
        var registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false); // filter must run inside SecurityFilterChain, not twice as a servlet filter
        return registration;
    }
    @Bean SecurityFilterChain chain(HttpSecurity http,ApiAuthenticationFilter filter) throws Exception{
        return http.csrf(c->c.disable())
            .sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(e->e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .authorizeHttpRequests(a->a
                .requestMatchers("/actuator/health/**","/api/public/**","/api/internal/**").permitAll()
                .anyRequest().authenticated())
            .addFilterBefore(filter,UsernamePasswordAuthenticationFilter.class).build();
    }
}
