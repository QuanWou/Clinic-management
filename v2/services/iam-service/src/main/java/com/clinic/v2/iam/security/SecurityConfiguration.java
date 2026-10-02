package com.clinic.v2.iam.security;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.*;
import org.springframework.security.web.authentication.*;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfiguration {
    @Bean FilterRegistrationBean<UserAuthenticationFilter> disableServletRegistration(UserAuthenticationFilter filter){
        var r=new FilterRegistrationBean<>(filter);r.setEnabled(false);return r;
    }
    @Bean SecurityFilterChain chain(HttpSecurity http,UserAuthenticationFilter filter)throws Exception{
        return http.csrf(c->c.disable())
            .sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(e->e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .authorizeHttpRequests(a->a
                .requestMatchers("/actuator/health/**","/api/v2/internal/**").permitAll()
                .anyRequest().authenticated())
            .addFilterBefore(filter,UsernamePasswordAuthenticationFilter.class).build();
    }
}
