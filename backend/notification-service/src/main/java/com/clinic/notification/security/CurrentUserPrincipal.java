package com.clinic.notification.security;

import java.util.Collection;
import java.util.UUID;
import org.springframework.security.core.GrantedAuthority;

public record CurrentUserPrincipal(
    UUID id,
    String email,
    Collection<? extends GrantedAuthority> authorities
) {}
