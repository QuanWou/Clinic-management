package com.clinic.clinic.security;

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

    public IdentityClient(@Value("${clinic.security.iam-url}") String url) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(2));
        factory.setReadTimeout(Duration.ofSeconds(2));
        client = RestClient.builder().baseUrl(url).requestFactory(factory).build();
    }

    public Actor current(String bearer) {
        try {
            CurrentActor me = client.get().uri("/api/me/current")
                .header(HttpHeaders.AUTHORIZATION, bearer)
                .retrieve().body(CurrentActor.class);
            if (me == null || me.userId() == null || me.legacyRoles() == null || me.legacyRoles().isEmpty()) {
                return null;
            }
            return new Actor(me.userId(), Set.copyOf(me.legacyRoles()));
        } catch (Exception ex) {
            return null; // IAM/session/revoke dependency fails closed
        }
    }

    public record CurrentActor(UUID userId, Set<String> legacyRoles, boolean platformOperator) {}
}
