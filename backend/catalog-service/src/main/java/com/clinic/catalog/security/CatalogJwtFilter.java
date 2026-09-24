package com.clinic.catalog.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.UUID;

public class CatalogJwtFilter extends OncePerRequestFilter {
    private final SecretKey key;

    public CatalogJwtFilter(String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            SecurityContextHolder.clearContext();
            try {
                Claims claims = Jwts.parser().verifyWith(key).build()
                        .parseSignedClaims(header.substring(7)).getPayload();
                Date now = new Date();
                String subject = claims.getSubject();
                if (claims.getExpiration() != null && claims.getExpiration().after(now)
                        && claims.getIssuedAt() != null && !claims.getIssuedAt().after(now)
                        && "access".equals(claims.get("token_type", String.class))
                        && subject != null && UUID.fromString(subject).toString().equalsIgnoreCase(subject)
                        && claims.get("email") instanceof String email && !email.isBlank()
                        && claims.get("roles") instanceof List<?> roleValues
                        && !roleValues.isEmpty()
                        && roleValues.stream().allMatch(role -> role instanceof String name && name.startsWith("ROLE_"))) {
                    var authorities = roleValues.stream()
                            .map(role -> new SimpleGrantedAuthority((String) role)).toList();
                    UUID userId = UUID.fromString(subject);
                    var auth = new UsernamePasswordAuthenticationToken(userId, null, authorities);
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (RuntimeException ignored) {
                // An invalid token cannot authenticate the request.
                SecurityContextHolder.clearContext();
            }
        }
        chain.doFilter(request, response);
    }
}