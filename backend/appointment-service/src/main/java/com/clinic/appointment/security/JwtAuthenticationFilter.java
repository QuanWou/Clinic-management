package com.clinic.appointment.security;

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
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final IdentityAccountClient identityAccountClient;

    public JwtAuthenticationFilter(JwtService jwtService, IdentityAccountClient identityAccountClient) {
        this.jwtService = jwtService;
        this.identityAccountClient = identityAccountClient;
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

        SecurityContextHolder.clearContext();
        String token = authHeader.substring(7);
        if (!jwtService.isTokenValid(token)) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            Claims claims = jwtService.extractAllClaims(token);
            Object rawRoles = claims.get("roles");
            if ("access".equals(claims.get("token_type", String.class))
                    && rawRoles instanceof List<?> roleNames && !roleNames.isEmpty()
                    && roleNames.stream().allMatch(role -> role instanceof String name && name.startsWith("ROLE_"))) {
                UUID userId = UUID.fromString(claims.getSubject());
                Set<String> roles = roleNames.stream().map(String.class::cast).collect(Collectors.toUnmodifiableSet());
                if (identityAccountClient.isCurrentAccount(authHeader, userId, roles)) {
                    String email = claims.get("email", String.class);
                    var authorities = roles.stream().map(SimpleGrantedAuthority::new).collect(Collectors.toSet());
                    CurrentUserPrincipal principal = new CurrentUserPrincipal(userId, email, email, roles);
                    SecurityContextHolder.getContext().setAuthentication(
                            new UsernamePasswordAuthenticationToken(principal, null, authorities));
                }
            }
        } catch (RuntimeException ex) {
            // A valid signature is not enough: malformed subjects/claims cannot authenticate.
            SecurityContextHolder.clearContext();
        }
        filterChain.doFilter(request, response);
    }
}
