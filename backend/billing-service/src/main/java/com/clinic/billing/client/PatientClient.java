package com.clinic.billing.client;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.dto.ApiResponse;
import com.clinic.common.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Component
public class PatientClient {

    private final RestClient restClient;

    public PatientClient(RestClient.Builder restClientBuilder, @Value("${services.patient.url}") String patientServiceUrl) {
        this.restClient = restClientBuilder.baseUrl(patientServiceUrl).build();
    }

    public PatientProfileResponse getCurrentPatientProfile(String authorizationHeader) {
        try {
            ApiResponse<PatientProfileResponse> response = restClient.get()
                    .uri("/api/patients/profile")
                    .header(HttpHeaders.AUTHORIZATION, authorizationHeader)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {
                    });

            if (response == null || response.data() == null) {
                throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Patient profile not found");
            }

            return response.data();
        } catch (BusinessException ex) {
            throw ex;
        } catch (RestClientResponseException ex) {
            throw mapRemoteError(ex);
        } catch (RestClientException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "Unable to resolve patient profile");
        }
    }

    private BusinessException mapRemoteError(RestClientResponseException ex) {
        return switch (ex.getStatusCode().value()) {
            case 401 -> new BusinessException(ErrorCode.UNAUTHORIZED, "Unauthorized when resolving patient profile");
            case 403 -> new BusinessException(ErrorCode.FORBIDDEN, "Forbidden when resolving patient profile");
            case 404 -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Patient profile not found");
            default -> new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "Unable to resolve patient profile");
        };
    }
}
