package com.clinic.appointment.client;

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

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class PatientClient {

    private final RestClient restClient;
    private final String internalServiceKey;

    public PatientClient(RestClient.Builder restClientBuilder,
                         @Value("${services.patient.url}") String patientServiceUrl,
                         @Value("${app.internal.service-key}") String internalServiceKey) {
        this.restClient = restClientBuilder.baseUrl(patientServiceUrl).build();
        this.internalServiceKey = internalServiceKey;
    }

    public PatientProfileResponse getCurrentPatientProfile(String authorizationHeader) {
        try {
            ApiResponse<PatientProfileResponse> response = restClient.get()
                    .uri("/api/patients/profile")
                    .header(HttpHeaders.AUTHORIZATION, authorizationHeader)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            if (response == null || response.data() == null) {
                throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Patient profile not found");
            }
            return response.data();
        } catch (BusinessException ex) {
            throw ex;
        } catch (RestClientException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "Unable to resolve patient profile");
        }
    }

    public ReceptionPatientLookupResponse getPatientForReception(String authorizationHeader, UUID patientId) {
        try {
            ApiResponse<ReceptionPatientLookupResponse> response = restClient.get()
                    .uri("/api/patients/reception/{id}", patientId)
                    .header(HttpHeaders.AUTHORIZATION, authorizationHeader)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            if (response == null || response.data() == null || !patientId.equals(response.data().id())) {
                throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Patient not found");
            }
            return response.data();
        } catch (BusinessException ex) {
            throw ex;
        } catch (RestClientResponseException ex) {
            throw switch (ex.getStatusCode().value()) {
                case 401 -> new BusinessException(ErrorCode.UNAUTHORIZED, "Unauthorized to access patient");
                case 403 -> new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to access patient");
                case 404 -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Patient not found");
                default -> new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "Unable to resolve patient");
            };
        } catch (RestClientException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "Unable to resolve patient");
        }
    }

    public InternalPatientSummaryResponse getInternalSummary(UUID patientId) {
        try {
            ApiResponse<InternalPatientSummaryResponse> response = restClient.get()
                    .uri("/internal/patients/{id}/summary", patientId)
                    .header("X-Internal-Service-Key", internalServiceKey)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            if (response == null || response.data() == null || !patientId.equals(response.data().patientId())) {
                throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Patient summary not found");
            }
            return response.data();
        } catch (BusinessException ex) {
            throw ex;
        } catch (RestClientResponseException ex) {
            throw mapInternalError(ex);
        } catch (RestClientException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "Unable to resolve patient summary");
        }
    }

    public List<InternalPatientSummaryResponse> getInternalSummaries(List<UUID> patientIds) {
        if (patientIds == null || patientIds.isEmpty()) {
            return List.of();
        }
        try {
            ApiResponse<List<InternalPatientSummaryResponse>> response = restClient.post()
                    .uri("/internal/patients/summaries")
                    .header("X-Internal-Service-Key", internalServiceKey)
                    .body(Map.of("patientIds", patientIds))
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            if (response == null || response.data() == null) {
                throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "Unable to resolve patient summaries");
            }
            return response.data();
        } catch (BusinessException ex) {
            throw ex;
        } catch (RestClientResponseException ex) {
            throw mapInternalError(ex);
        } catch (RestClientException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "Unable to resolve patient summaries");
        }
    }

    private BusinessException mapInternalError(RestClientResponseException ex) {
        return switch (ex.getStatusCode().value()) {
            case 403 -> new BusinessException(ErrorCode.FORBIDDEN, "Patient directory rejected internal credential");
            case 404 -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Patient summary not found");
            default -> new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "Unable to resolve patient summary");
        };
    }
}
