package com.clinic.v2.iam.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.*;

@Component
public class ClinicDirectoryClient {
    private final RestClient client;
    private final WorkloadTokens tokens;
    private final String issuer;
    private final String audience;

    public ClinicDirectoryClient(@Value("${iam.clinic.url}") String url,
                                 @Value("${iam.clinic.workload-issuer}") String issuer,
                                 @Value("${iam.clinic.workload-audience}") String audience,
                                 WorkloadTokens tokens) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(2));
        factory.setReadTimeout(Duration.ofSeconds(2));
        this.client = RestClient.builder().baseUrl(url).requestFactory(factory).build();
        this.tokens = tokens;
        this.issuer = issuer;
        this.audience = audience;
    }

    public boolean clinicExists(UUID clinicId) {
        ScopeValidation body = scope(clinicId, null);
        return body != null && body.exists() && clinicId.equals(body.clinicId());
    }

    public boolean clinicOwnedBy(UUID clinicId, UUID ownerUserId) {
        ScopeValidation body = scope(clinicId, null);
        return body != null && body.exists()
            && clinicId.equals(body.clinicId())
            && ownerUserId != null
            && ownerUserId.equals(body.ownerUserId());
    }

    public boolean branchExists(UUID clinicId, UUID branchId) {
        ScopeValidation body = scope(clinicId, branchId);
        return body != null && body.exists()
            && clinicId.equals(body.clinicId())
            && body.validBranchIds() != null
            && body.validBranchIds().contains(branchId);
    }

    private ScopeValidation scope(UUID clinicId, UUID branchId) {
        try {
            return client.get()
                .uri(uri -> {
                    var builder = uri.path("/api/v2/internal/clinics/{id}/scope");
                    if (branchId != null) builder.queryParam("branchIds", branchId.toString());
                    return builder.build(clinicId);
                })
                .header(HttpHeaders.AUTHORIZATION,
                    "Bearer " + tokens.mint(issuer, audience, "clinic.scope.read"))
                .retrieve().body(ScopeValidation.class);
        } catch (Exception ex) {
            return null; // directory dependency fails closed
        }
    }

    public record ScopeValidation(UUID clinicId, UUID ownerUserId, boolean exists, Set<UUID> validBranchIds) {}
}
