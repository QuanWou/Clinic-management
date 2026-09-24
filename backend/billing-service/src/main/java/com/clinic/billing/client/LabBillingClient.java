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
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Uses Task 04's read-only, non-clinical billing contract; no fallback to empty orders on HTTP errors. */
@Component
public class LabBillingClient {
    private final RestClient client;

    public LabBillingClient(RestClient.Builder builder, @Value("${services.medical.url}") String medicalUrl) {
        this.client = builder.baseUrl(medicalUrl).build();
    }

    public LabItems get(String authorization, UUID appointmentId) {
        try {
            ApiResponse<LabItems> response = client.get()
                    .uri("/api/medical-records/appointments/{appointmentId}/billable-items", appointmentId)
                    .header(HttpHeaders.AUTHORIZATION, authorization).retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            if (response == null || !response.success() || response.data() == null
                    || !appointmentId.equals(response.data().appointmentId()) || response.data().items() == null) {
                throw new BusinessException(ErrorCode.CONFLICT, "Lab billing list unavailable or mismatched");
            }
            return response.data();
        } catch (BusinessException ex) {
            throw ex;
        } catch (RestClientException ex) {
            throw new BusinessException(ErrorCode.CONFLICT, "Lab billing API unavailable; invoice not created");
        }
    }

    // Task 04's current API has only appointmentId/items. The extra fields are a REQUIRED
    // future freeze contract: absent values deserialize to null and prevent invoice creation.
    public record LabItems(UUID appointmentId, List<LabItem> items,
                           Boolean finalizedForBilling, String billableRevision) {}
    public record LabItem(UUID orderId, String testCode, int quantity, String status, LocalDateTime billableAt,
                          UUID serviceId, LocalDate performedOn) {}
}