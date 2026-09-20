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

import java.util.UUID;

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
        } catch (RestClientException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "Unable to resolve patient profile");
        }
    }

    /** Resolve staff bookings by authoritative patient profile ID. */
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
}
