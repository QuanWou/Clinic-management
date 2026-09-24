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

import java.util.UUID;

@Component
public class CatalogClient {
    private final RestClient client;

    public CatalogClient(RestClient.Builder builder, @Value("${services.catalog.url}") String catalogUrl) {
        this.client = builder.baseUrl(catalogUrl).build();
    }

    public CatalogService requireActiveService(String authorization, UUID serviceId, String expectedCode) {
        try {
            ApiResponse<CatalogService> response = client.get()
                    .uri("/api/catalog/services/{id}", serviceId)
                    .header(HttpHeaders.AUTHORIZATION, authorization)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            CatalogService service = response == null ? null : response.data();
            if (response == null || !response.success() || service == null
                    || !serviceId.equals(service.id()) || !service.active()
                    || service.code() == null || !service.code().equalsIgnoreCase(expectedCode)
                    || service.name() == null || service.name().isBlank()) {
                throw invalidService();
            }
            return service;
        } catch (BusinessException ex) {
            throw ex;
        } catch (RestClientException ex) {
            throw invalidService();
        }
    }

    public CatalogMedicine requireActiveMedicine(String authorization, UUID medicineId) {
        try {
            ApiResponse<CatalogMedicine> response = client.get()
                    .uri("/api/catalog/medicines/{id}", medicineId)
                    .header(HttpHeaders.AUTHORIZATION, authorization)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            CatalogMedicine medicine = response == null ? null : response.data();
            if (response == null || !response.success() || medicine == null
                    || !medicineId.equals(medicine.id()) || !medicine.active()
                    || medicine.code() == null || medicine.code().isBlank()
                    || medicine.name() == null || medicine.name().isBlank()
                    || medicine.unit() == null || medicine.unit().isBlank()) {
                throw invalidMedicine();
            }
            return medicine;
        } catch (BusinessException ex) {
            throw ex;
        } catch (RestClientException ex) {
            throw invalidMedicine();
        }
    }

    private BusinessException invalidService() {
        return new BusinessException(ErrorCode.CONFLICT,
                "Lab test must match an active catalog service");
    }

    private BusinessException invalidMedicine() {
        return new BusinessException(ErrorCode.CONFLICT,
                "Prescription medicine must match an active catalog medicine");
    }

    public record CatalogService(UUID id, String code, String name, String description, boolean active) {}

    public record CatalogMedicine(UUID id, String code, String name, String unit, String description, boolean active) {}
}
