package com.clinic.appointment.client;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.dto.ApiResponse;
import com.clinic.common.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.UUID;

@Component
public class RecipientDirectoryClient {
    private final RestClient restClient;
    private final String serviceKey;

    public RecipientDirectoryClient(RestClient.Builder builder,
                                    @Value("${services.patient.url}") String patientUrl,
                                    @Value("${app.internal.service-key}") String serviceKey) {
        this.restClient = builder.baseUrl(patientUrl).build();
        this.serviceKey = serviceKey;
    }

    public UUID resolve(UUID patientId) {
        try {
            ApiResponse<Recipient> response = restClient.get()
                    .uri("/internal/patients/{id}/recipient", patientId)
                    .header("X-Internal-Service-Key", serviceKey)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            if (response == null || response.data() == null
                    || !patientId.equals(response.data().patientId())
                    || response.data().userId() == null) {
                throw new BusinessException(ErrorCode.CONFLICT, "Patient has no notification recipient");
            }
            return response.data().userId();
        } catch (BusinessException ex) {
            throw ex;
        } catch (RestClientException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "Unable to resolve notification recipient");
        }
    }

    private record Recipient(UUID patientId, UUID userId) {}
}
