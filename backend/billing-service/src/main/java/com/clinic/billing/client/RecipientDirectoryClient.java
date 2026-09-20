package com.clinic.billing.client;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.dto.ApiResponse;
import com.clinic.common.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Optional;
import java.util.UUID;

@Component
public class RecipientDirectoryClient {
    private final RestClient client;
    private final String serviceKey;

    public RecipientDirectoryClient(RestClient.Builder builder,
                                    @Value("${services.patient.url}") String patientUrl,
                                    @Value("${app.internal.service-key}") String serviceKey) {
        this.client = builder.baseUrl(patientUrl).build();
        this.serviceKey = serviceKey;
    }

    /** Empty means a verified patient profile without an Identity account; failures throw. */
    public Optional<UUID> findLinkedUser(UUID patientId) {
        try {
            ApiResponse<Recipient> response = client.get()
                    .uri("/internal/patients/{id}/recipient", patientId)
                    .header("X-Internal-Service-Key", serviceKey)
                    .retrieve().body(new ParameterizedTypeReference<>() {});
            Recipient recipient = response == null ? null : response.data();
            if (response == null || !response.success() || recipient == null
                    || !patientId.equals(recipient.patientId())) throw unavailable();
            return Optional.ofNullable(recipient.userId());
        } catch (BusinessException ex) {
            throw ex;
        } catch (RestClientException ex) {
            throw unavailable();
        }
    }

    private BusinessException unavailable() {
        return new BusinessException(ErrorCode.CONFLICT, "Patient notification recipient could not be resolved");
    }

    public record Recipient(UUID patientId, UUID userId) {}
}
