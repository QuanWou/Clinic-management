package com.clinic.appointment.client;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.dto.ApiResponse;
import com.clinic.common.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.time.LocalTime;
import java.util.UUID;

@Component
public class DoctorClient {
    private final RestClient restClient;

    public DoctorClient(RestClient.Builder restClientBuilder, @Value("${services.doctor.url}") String doctorServiceUrl) {
        this.restClient = restClientBuilder.baseUrl(doctorServiceUrl).build();
    }

    public DoctorAvailabilityResponse getAvailability(String authorizationHeader, UUID doctorId, Integer dayOfWeek, LocalTime startTime, LocalTime endTime) {
        try {
            ApiResponse<DoctorAvailabilityResponse> response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/doctors/{doctorId}/availability")
                            .queryParam("dayOfWeek", dayOfWeek)
                            .queryParam("startTime", startTime)
                            .queryParam("endTime", endTime)
                            .build(doctorId))
                    .header(HttpHeaders.AUTHORIZATION, authorizationHeader)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {
                    });

            if (response == null || response.data() == null) {
                throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Doctor availability not found");
            }

            return response.data();
        } catch (BusinessException ex) {
            throw ex;
        } catch (RestClientResponseException ex) {
            throw mapRemoteError(ex);
        } catch (RestClientException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "Unable to resolve doctor availability");
        }
    }

    private BusinessException mapRemoteError(RestClientResponseException ex) {
        return switch (ex.getStatusCode().value()) {
            case 401 -> new BusinessException(ErrorCode.UNAUTHORIZED, "Unauthorized when checking doctor availability");
            case 403 -> new BusinessException(ErrorCode.FORBIDDEN, "Forbidden when checking doctor availability");
            case 404 -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Doctor not found");
            default -> new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "Unable to resolve doctor availability");
        };
    }
}
