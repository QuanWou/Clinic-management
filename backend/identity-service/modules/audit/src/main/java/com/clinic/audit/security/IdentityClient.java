package com.clinic.audit.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.Set;
import java.util.UUID;

@Component
public class IdentityClient {
    private final RestClient client;

    public IdentityClient(@Value("${audit.security.identity-url}") String url) {
        var factory=new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(2));
        factory.setReadTimeout(Duration.ofSeconds(2));
        client=RestClient.builder().baseUrl(url).requestFactory(factory).build();
    }

    public Actor current(String bearer) {
        if (bearer==null||bearer.isBlank()) return null;
        try {
            Current current=client.get().uri("/api/me/current")
                .header(HttpHeaders.AUTHORIZATION,bearer)
                .retrieve().body(Current.class);
            return current==null?null:new Actor(current.userId(),
                current.legacyRoles()==null?Set.of():Set.copyOf(current.legacyRoles()));
        } catch (Exception ex) {
            return null;
        }
    }

    record Current(UUID userId, Set<String> legacyRoles, boolean platformOperator) {}
}
