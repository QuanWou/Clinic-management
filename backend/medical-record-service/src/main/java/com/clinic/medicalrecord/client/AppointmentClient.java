package com.clinic.medicalrecord.client;

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
public class AppointmentClient {

    private final RestClient restClient;

    public AppointmentClient(RestClient.Builder restClientBuilder,
                             @Value("${services.appointment.url}") String appointmentServiceUrl) {
        this.restClient = restClientBuilder.baseUrl(appointmentServiceUrl).build();
    }

    public AppointmentResponse getById(String authorizationHeader, UUID appointmentId) {
        try {
            ApiResponse<AppointmentResponse> response = restClient.get()
                    .uri("/api/appointments/{id}", appointmentId)
                    .header(HttpHeaders.AUTHORIZATION, authorizationHeader)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});

            if (response == null || response.data() == null) {
                throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Appointment not found");
            }
            return response.data();
        } catch (BusinessException ex) {
            throw ex;
        } catch (RestClientResponseException ex) {
            throw mapRemoteError(ex);
        } catch (RestClientException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "Unable to resolve appointment");
        }
    }

    public EncounterContextResponse getEncounterContext(String authorizationHeader, UUID appointmentId) {
        try {
            ApiResponse<EncounterContextResponse> response = restClient.get()
                    .uri("/api/appointments/{id}/encounter", appointmentId)
                    .header(HttpHeaders.AUTHORIZATION, authorizationHeader)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});

            if (response == null || response.data() == null
                    || !appointmentId.equals(response.data().appointmentId())) {
                throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Encounter context not found");
            }
            return response.data();
        } catch (BusinessException ex) {
            throw ex;
        } catch (RestClientResponseException ex) {
            throw mapRemoteError(ex);
        } catch (RestClientException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "Unable to resolve encounter context");
        }
    }

    private BusinessException mapRemoteError(RestClientResponseException ex) {
        return switch (ex.getStatusCode().value()) {
            case 401 -> new BusinessException(ErrorCode.UNAUTHORIZED, "Unauthorized when resolving appointment");
            case 403 -> new BusinessException(ErrorCode.FORBIDDEN, "Forbidden when resolving appointment");
            case 404 -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Appointment not found");
            case 409 -> new BusinessException(ErrorCode.CONFLICT, "Appointment encounter is inconsistent");
            default -> new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "Unable to resolve appointment");
        };
    }
}
