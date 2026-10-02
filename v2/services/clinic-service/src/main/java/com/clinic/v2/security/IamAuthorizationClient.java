package com.clinic.v2.security;

import com.clinic.v2.api.ApiProblem;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.*;

@Component
public class IamAuthorizationClient {
    private final RestClient client;
    private final IamWorkloadTokenIssuer tokens;

    public IamAuthorizationClient(@Value("${clinic.security.iam-url}") String url,
                                  IamWorkloadTokenIssuer tokens) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(2));
        factory.setReadTimeout(Duration.ofSeconds(2));
        client = RestClient.builder().baseUrl(url).requestFactory(factory).build();
        this.tokens = tokens;
    }

    public boolean allowed(UUID userId, String capability, UUID clinicId, UUID branchId) {
        try {
            AuthorizationResult result = client.post()
                .uri("/api/v2/internal/iam/authorization/check")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokens.issue("iam.authorize"))
                .contentType(MediaType.APPLICATION_JSON)
                .body(new AuthorizationRequest(userId, clinicId, branchId, capability))
                .retrieve().body(AuthorizationResult.class);
            return result != null && result.allowed();
        } catch (Exception ex) {
            return false; // authorization dependency fails closed
        }
    }

    public List<ContextResult> contexts(UUID userId) {
        try {
            ContextResult[] result = client.get()
                .uri("/api/v2/internal/iam/users/{userId}/contexts", userId)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokens.issue("iam.contexts.read"))
                .retrieve().body(ContextResult[].class);
            return result == null ? List.of() : List.of(result);
        } catch (Exception ex) {
            return List.of(); // fail closed
        }
    }

    public void provisionOwner(UUID userId, UUID clinicId) {
        try {
            client.post().uri("/api/v2/internal/iam/owners")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokens.issue("iam.owner.provision"))
                .contentType(MediaType.APPLICATION_JSON)
                .body(new OwnerProvisionRequest(userId, clinicId, "Clinic creator membership provision"))
                .retrieve().toBodilessEntity();
        } catch (Exception ex) {
            throw ApiProblem.dependency(
                "Clinic exists but owner membership provisioning is unavailable; retry the owner-link action");
        }
    }

    public record AuthorizationRequest(UUID actorUserId, UUID clinicId, UUID branchId, String capability) {}
    public record AuthorizationResult(boolean allowed, UUID membershipId, String role,
                                      long membershipVersion, String reason) {}
    public record ContextResult(UUID membershipId, UUID clinicId, String role, boolean allBranches,
                                List<UUID> branchIds, long version) {}
    public record OwnerProvisionRequest(UUID userId, UUID clinicId, String reason) {}
}
