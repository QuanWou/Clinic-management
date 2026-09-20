package com.clinic.doctor.client;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Set;
import java.util.UUID;

@Component
public class AdminIdentityClient {
    private final RestClient client;

    public AdminIdentityClient(@Value("${services.identity-url}") String baseUrl) {
        this.client = RestClient.builder().baseUrl(baseUrl).build();
    }

    public void verifyDoctorUser(UUID userId, String authorization) {
        try {
            IdentityUserEnvelope envelope = client.get()
                    .uri("/api/users/admin/{id}", userId)
                    .header("Authorization", authorization)
                    .retrieve()
                    .onStatus(status -> status.value() == 404, (request, response) -> {
                        throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Identity user not found");
                    })
                    .onStatus(HttpStatusCode::is4xxClientError, (request, response) -> {
                        throw new BusinessException(ErrorCode.FORBIDDEN,
                                "Identity did not authorize or find the requested user");
                    })
                    .body(IdentityUserEnvelope.class);
            if (envelope == null || envelope.data() == null
                    || !"ACTIVE".equals(envelope.data().status())
                    || envelope.data().roles() == null
                    || !envelope.data().roles().contains("ROLE_DOCTOR")) {
                throw new BusinessException(ErrorCode.CONFLICT, "User must be active and have the DOCTOR role");
            }
        } catch (RestClientException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "Identity service unavailable");
        }
    }

    private record IdentityUserEnvelope(boolean success, IdentityUser data) {
    }

    private record IdentityUser(String status, Set<String> roles) {
    }
}