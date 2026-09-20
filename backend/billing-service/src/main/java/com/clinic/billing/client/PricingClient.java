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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** The catalog owns service prices, not appointment quotes. Never trust a client-provided price. */
@Component
public class PricingClient {
    private final RestClient client;

    public PricingClient(RestClient.Builder builder, @Value("${services.catalog.url}") String catalogUrl) {
        this.client = builder.baseUrl(catalogUrl).build();
    }

    public PricedService byServiceId(String authorization, UUID serviceId, LocalDate date) {
        if (serviceId == null || date == null) {
            throw unavailable("A verified service ID and date are required");
        }
        try {
            ApiResponse<CatalogService> serviceResponse = client.get()
                    .uri("/api/catalog/services/{id}", serviceId)
                    .header(HttpHeaders.AUTHORIZATION, authorization).retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            CatalogService service = verified(serviceResponse);
            if (service == null || !serviceId.equals(service.id()) || !service.active()
                    || service.code() == null || service.code().isBlank()
                    || service.code().length() > 60 || service.name() == null
                    || service.name().isBlank() || service.name().length() > 255) {
                throw unavailable("Catalog service missing, inactive, or invalid");
            }
            ApiResponse<CatalogPrice> priceResponse = client.get()
                    .uri(uri -> uri.path("/api/catalog/services/{id}/price")
                            .queryParam("on", date.toString()).build(serviceId))
                    .header(HttpHeaders.AUTHORIZATION, authorization).retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            CatalogPrice price = verified(priceResponse);
            if (price == null || price.id() == null || !serviceId.equals(price.serviceId())
                    || price.amount() == null || price.amount().signum() <= 0
                    || price.amount().scale() > 2 || price.amount().precision() - price.amount().scale() > 10
                    || !"VND".equals(price.currency()) || price.effectiveFrom() == null
                    || price.effectiveFrom().isAfter(date)
                    || (price.effectiveUntil() != null && !date.isBefore(price.effectiveUntil()))) {
                throw unavailable("Effective catalog price missing, invalid, or outside its validity dates");
            }
            return new PricedService(service.id(), service.code(), service.name(), price.id(),
                    price.amount().setScale(2), price.currency(), date);
        } catch (BusinessException ex) {
            throw ex;
        } catch (RestClientException ex) {
            throw unavailable("Catalog service or effective price unavailable");
        }
    }

    /** Task 04 exposes lab testCode, not a service ID: resolve only an exact unique active code. */
    public PricedService byServiceCode(String authorization, String code, LocalDate date) {
        if (code == null || code.isBlank() || date == null) {
            throw unavailable("Verified lab test code and service date are required");
        }
        try {
            ApiResponse<List<CatalogService>> response = client.get()
                    .uri("/api/catalog/services")
                    .header(HttpHeaders.AUTHORIZATION, authorization).retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            List<CatalogService> activeServices = verified(response);
            if (activeServices == null) {
                throw unavailable("Active catalog services unavailable");
            }
            List<CatalogService> matches = activeServices.stream()
                    .filter(s -> s != null && s.active() && s.code() != null
                            && s.code().equalsIgnoreCase(code)).toList();
            if (matches.size() != 1 || matches.get(0).id() == null) {
                throw unavailable("Lab code does not resolve to exactly one active catalog service");
            }
            PricedService priced = byServiceId(authorization, matches.get(0).id(), date);
            if (!priced.code().equalsIgnoreCase(code)) {
                throw unavailable("Catalog code changed during price lookup");
            }
            return priced;
        } catch (BusinessException ex) {
            throw ex;
        } catch (RestClientException ex) {
            throw unavailable("Active catalog lookup unavailable");
        }
    }

    private static <T> T verified(ApiResponse<T> response) {
        if (response == null || !response.success() || response.data() == null) {
            throw unavailable("Catalog did not return a successful populated response");
        }
        return response.data();
    }

    private static BusinessException unavailable(String message) {
        return new BusinessException(ErrorCode.CONFLICT, message);
    }

    public record CatalogService(UUID id, String code, String name, String description, boolean active) {}
    public record CatalogPrice(UUID id, UUID serviceId, BigDecimal amount, String currency,
                               LocalDate effectiveFrom, LocalDate effectiveUntil) {}
    public record PricedService(UUID serviceId, String code, String name, UUID priceId,
                                BigDecimal unitPrice, String currency, LocalDate serviceDate) {}
}
