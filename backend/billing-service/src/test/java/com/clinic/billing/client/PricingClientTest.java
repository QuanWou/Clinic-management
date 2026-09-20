package com.clinic.billing.client;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class PricingClientTest {
    private static final String URL = "https://catalog.example.test";
    private MockRestServiceServer server;
    private PricingClient client;
    private UUID serviceId;
    private LocalDate date;

    @BeforeEach void setup() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        client = new PricingClient(builder, URL);
        serviceId = UUID.randomUUID(); date = LocalDate.of(2026, 9, 19);
    }

    private String service(boolean active) {
        return "{\"success\":true,\"data\":{\"id\":\"" + serviceId
                + "\",\"code\":\"CBC\",\"name\":\"Blood test\",\"active\":" + active + "}}";
    }
    private String price(String amount, String currency, UUID priceId, LocalDate from, LocalDate until) {
        return "{\"success\":true,\"data\":{\"id\":\"" + priceId + "\",\"serviceId\":\""
                + serviceId + "\",\"amount\":" + amount + ",\"currency\":\"" + currency
                + "\",\"effectiveFrom\":\"" + from + "\",\"effectiveUntil\":"
                + (until == null ? "null" : "\"" + until + "\"") + "}}";
    }
    private void expectService(boolean active) {
        server.expect(requestTo(URL + "/api/catalog/services/" + serviceId))
                .andExpect(header("Authorization", "Bearer jwt"))
                .andRespond(withSuccess(service(active), MediaType.APPLICATION_JSON));
    }
    private void expectPrice(String amount, String currency, LocalDate from, LocalDate until) {
        server.expect(requestTo(URL + "/api/catalog/services/" + serviceId + "/price?on=" + date))
                .andExpect(header("Authorization", "Bearer jwt"))
                .andRespond(withSuccess(price(amount, currency, UUID.randomUUID(), from, until), MediaType.APPLICATION_JSON));
    }
    private BusinessException fails() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> client.byServiceId("Bearer jwt", serviceId, date));
        server.verify(); return ex;
    }
    @Test void realCatalogServiceAndEffectivePriceAreUsed() {
        expectService(true); expectPrice("250000.00", "VND", date.minusDays(1), date.plusDays(1));
        PricingClient.PricedService result = client.byServiceId("Bearer jwt", serviceId, date);
        assertEquals(serviceId, result.serviceId()); assertNotNull(result.priceId());
        assertEquals(new BigDecimal("250000.00"), result.unitPrice()); server.verify();
    }
    @Test void absentCatalogPriceFailsClosed() {
        expectService(true);
        server.expect(requestTo(URL + "/api/catalog/services/" + serviceId + "/price?on=" + date))
                .andRespond(withStatus(HttpStatus.NOT_FOUND));
        assertEquals(ErrorCode.CONFLICT, fails().getErrorCode());
    }
    @Test void inactiveCatalogServiceFailsClosed() {
        expectService(false); assertEquals(ErrorCode.CONFLICT, fails().getErrorCode());
    }
    @Test void invalidZeroPriceFailsClosed() {
        expectService(true); expectPrice("0", "VND", date.minusDays(1), null);
        assertEquals(ErrorCode.CONFLICT, fails().getErrorCode());
    }
    @Test void invalidCurrencyFailsClosed() {
        expectService(true); expectPrice("100", "USD", date.minusDays(1), null);
        assertEquals(ErrorCode.CONFLICT, fails().getErrorCode());
    }
    @Test void stalePricePeriodFailsClosed() {
        expectService(true); expectPrice("100", "VND", date.minusDays(10), date);
        assertEquals(ErrorCode.CONFLICT, fails().getErrorCode());
    }
    @Test void labCodeUsesExactActiveCatalogCodeNotName() {
        server.expect(requestTo(URL + "/api/catalog/services"))
                .andRespond(withSuccess("{\"success\":true,\"data\":[{\"id\":\"" + serviceId
                        + "\",\"code\":\"CBC\",\"name\":\"Blood test\",\"active\":true}]}", MediaType.APPLICATION_JSON));
        expectService(true); expectPrice("100", "VND", date.minusDays(1), null);
        assertEquals(serviceId, client.byServiceCode("Bearer jwt", "cbc", date).serviceId()); server.verify();
    }
    @Test void unknownLabCodeFailsClosedWithoutGuessingId() {
        server.expect(requestTo(URL + "/api/catalog/services"))
                .andRespond(withSuccess("{\"success\":true,\"data\":[]}", MediaType.APPLICATION_JSON));
        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> client.byServiceCode("Bearer jwt", "CBC", date)).getErrorCode()); server.verify();
    }
}
