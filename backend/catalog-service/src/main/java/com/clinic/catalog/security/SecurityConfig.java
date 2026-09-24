package com.clinic.catalog.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
    @Bean
    public CatalogJwtFilter catalogJwtFilter(@Value("${app.security.jwt.secret}") String secret) {
        return new CatalogJwtFilter(secret);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, CatalogJwtFilter filter) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/catalog/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .addFilterBefore(filter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}