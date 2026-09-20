package com.clinic.appointment.security;

import com.clinic.common.dto.ApiResponse;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Set;
import java.util.UUID;

/**
 * Resolve current account state from the identity service instead of trusting stale JWT roles.
 * The identity service validates the access-token purpose and reads status/roles from its DB.
 * A failed or unavailable check must never grant access.
 */
@Component
public class IdentityAccountClient {
    private final RestClient restClient;

    @Autowired
    public IdentityAccountClient(RestClient.Builder builder,
                                 @Value("${services.identity.url:${SERVICES_IDENTITY_URL:http://identity-service:8083}}") String identityUrl) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(1500);
        requestFactory.setReadTimeout(1500);
        this.restClient = builder.clone().baseUrl(identityUrl).requestFactory(requestFactory).build();
    }

    // Allows transport-level tests to inject MockRestServiceServer without overriding
    // the production request factory and its network timeouts.
    IdentityAccountClient(RestClient restClient) {
        this.restClient = restClient;
    }

    public boolean isCurrentAccount(String authorizationHeader, UUID subject, Set<String> tokenRoles) {
        if (authorizationHeader == null || subject == null || tokenRoles == null || tokenRoles.isEmpty()) {
            return false;
        }
        try {
            ApiResponse<AccountResponse> response = restClient.get()
                    .uri("/api/users/me")
                    .header(HttpHeaders.AUTHORIZATION, authorizationHeader)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            AccountResponse account = response == null || !response.success() ? null : response.data();
            return account != null
                    && subject.equals(account.id())
                    && "ACTIVE".equals(account.status())
                    && tokenRoles.equals(account.roles());
        } catch (RuntimeException ex) {
            // Includes unavailable identity service, HTTP 401/403, and malformed responses.
            return false;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AccountResponse(UUID id, String status, Set<String> roles) {}
}
