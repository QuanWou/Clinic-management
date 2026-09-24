package com.clinic.patient.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthenticationFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        if (!jwtService.isAccessTokenValid(token)) {
            filterChain.doFilter(request, response);
            return;
        }

        UUID userId;
        String email;
        Set<String> roles;
        try {
            Claims claims = jwtService.extractAllClaims(token);
            userId = UUID.fromString(claims.getSubject());
            email = claims.get("email", String.class);
            Object rawRoles = claims.get("roles");
            if (email == null || email.isBlank() || !(rawRoles instanceof List<?> roleNames)
                    || roleNames.isEmpty() || roleNames.stream().anyMatch(role ->
                    !(role instanceof String name) || !name.matches("ROLE_(ADMIN|RECEPTIONIST|DOCTOR|PATIENT)"))) {
                filterChain.doFilter(request, response);
                return;
            }
            roles = roleNames.stream().map(String.class::cast).collect(Collectors.toUnmodifiableSet());
        } catch (IllegalArgumentException | ClassCastException ex) {
            filterChain.doFilter(request, response);
            return;
        }

        var authorities = roles.stream()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toSet());

        CurrentUserPrincipal principal = new CurrentUserPrincipal(
                userId,
                email,
                email,
                roles
        );

        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(principal, null, authorities);

        SecurityContextHolder.getContext().setAuthentication(authentication);
        filterChain.doFilter(request, response);
    }
}
