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
                throw invalid();
            }
            return service;
        } catch (BusinessException ex) {
            throw ex;
        } catch (RestClientException ex) {
            throw invalid();
        }
    }

    private BusinessException invalid() {
        return new BusinessException(ErrorCode.CONFLICT,
                "Lab test must match an active catalog service");
    }

    public record CatalogService(UUID id, String code, String name, String description, boolean active) {}
}
