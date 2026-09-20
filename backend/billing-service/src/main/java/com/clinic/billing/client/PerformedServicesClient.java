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

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Reads the appointment service's immutable, role-protected performed-service billing contract. */
@Component
public class PerformedServicesClient {
    private final RestClient client;

    public PerformedServicesClient(RestClient.Builder builder,
                                   @Value("${services.appointment.url}") String appointmentUrl) {
        this.client = builder.baseUrl(appointmentUrl).build();
    }

    public PerformedServices get(String authorization, UUID appointmentId) {
        try {
            ApiResponse<PerformedServices> response = client.get()
                    .uri("/api/appointments/{appointmentId}/performed-services", appointmentId)
                    .header(HttpHeaders.AUTHORIZATION, authorization)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            if (response == null || !response.success() || response.data() == null
                    || !appointmentId.equals(response.data().appointmentId())
                    || response.data().items() == null) {
                throw new BusinessException(ErrorCode.CONFLICT,
                        "Performed-service billing list unavailable or mismatched");
            }
            return response.data();
        } catch (BusinessException ex) {
            throw ex;
        } catch (RestClientException ex) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Performed-service billing API unavailable; invoice not created");
        }
    }

    public record PerformedServices(UUID appointmentId, boolean finalized, String revision, List<PerformedItem> items) {}
    public record PerformedItem(UUID performedItemId, UUID serviceId, int quantity, LocalDate serviceDate) {}
}
