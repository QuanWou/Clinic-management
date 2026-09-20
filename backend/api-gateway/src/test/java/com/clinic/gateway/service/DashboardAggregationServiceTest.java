package com.clinic.gateway.service;

import com.clinic.gateway.config.ServicesProperties;
import com.clinic.gateway.dto.DashboardResponse;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DashboardAggregationServiceTest {

    @Test
    void getCurrentUserDashboardAggregatesDownstreamResponses() {
        WebClient.Builder builder = WebClient.builder()
                .exchangeFunction(request -> Mono.just(ClientResponse.create(HttpStatus.OK)
                        .header("Content-Type", "application/json")
                        .body(responseFor(request.url().getPath()))
                        .build()));
        DashboardAggregationService service = new DashboardAggregationService(
                builder,
                new ServicesProperties(
                        "http://identity-service:8083",
                        "http://appointment-service:8086",
                        "http://medical-record-service:8087",
                        "http://billing-service:8088"
                )
        );

        StepVerifier.create(service.getCurrentUserDashboard("Bearer token"))
                .assertNext(response -> {
                    assertThat(response.user()).containsEntry("email", "patient@example.com");
                    assertThat(response.appointments()).hasSize(1);
                    assertThat(response.medicalRecords()).hasSize(1);
                    assertThat(response.invoices()).hasSize(1);
                })
                .verifyComplete();
    }

    @Test
    void getCurrentUserDashboardSkipsPatientServicesForNonPatientRole() {
        List<String> requestedPaths = new ArrayList<>();
        WebClient.Builder builder = WebClient.builder()
                .exchangeFunction(request -> {
                    requestedPaths.add(request.url().getPath());
                    return Mono.just(ClientResponse.create(HttpStatus.OK)
                            .header("Content-Type", "application/json")
                            .body("""
                                    {"success":true,"message":"Success","data":{"email":"doctor@example.com","roles":["ROLE_DOCTOR"]},"timestamp":"2026-05-15T00:00:00Z"}
                                    """)
                            .build());
                });
        DashboardAggregationService service = new DashboardAggregationService(builder, servicesProperties());

        StepVerifier.create(service.getCurrentUserDashboard("Bearer token"))
                .assertNext(response -> {
                    assertThat(response.appointments()).isEmpty();
                    assertThat(response.medicalRecords()).isEmpty();
                    assertThat(response.invoices()).isEmpty();
                })
                .verifyComplete();
        assertThat(requestedPaths).containsExactly("/api/users/me");
    }

    @Test
    void getCurrentUserDashboardKeepsAvailablePatientDataWhenOneServiceFails() {
        WebClient.Builder builder = WebClient.builder()
                .exchangeFunction(request -> {
                    if ("/api/appointments/my".equals(request.url().getPath())) {
                        return Mono.just(ClientResponse.create(HttpStatus.SERVICE_UNAVAILABLE).build());
                    }
                    return Mono.just(ClientResponse.create(HttpStatus.OK)
                            .header("Content-Type", "application/json")
                            .body(responseFor(request.url().getPath()))
                            .build());
                });
        DashboardAggregationService service = new DashboardAggregationService(builder, servicesProperties());

        StepVerifier.create(service.getCurrentUserDashboard("Bearer token"))
                .assertNext(response -> {
                    assertThat(response.appointments()).isEmpty();
                    assertThat(response.medicalRecords()).hasSize(1);
                    assertThat(response.invoices()).hasSize(1);
                })
                .verifyComplete();
    }

    private ServicesProperties servicesProperties() {
        return new ServicesProperties(
                "http://identity-service:8083",
                "http://appointment-service:8086",
                "http://medical-record-service:8087",
                "http://billing-service:8088"
        );
    }

    private String responseFor(String path) {
        return switch (path) {
            case "/api/users/me" -> """
                    {"success":true,"message":"Success","data":{"email":"patient@example.com","roles":["ROLE_PATIENT"]},"timestamp":"2026-05-15T00:00:00Z"}
                    """;
            case "/api/appointments/my" -> """
                    {"success":true,"message":"Success","data":[{"id":"appointment-1"}],"timestamp":"2026-05-15T00:00:00Z"}
                    """;
            case "/api/medical-records/my" -> """
                    {"success":true,"message":"Success","data":[{"id":"record-1"}],"timestamp":"2026-05-15T00:00:00Z"}
                    """;
            case "/api/invoices/my" -> """
                    {"success":true,"message":"Success","data":[{"id":"invoice-1"}],"timestamp":"2026-05-15T00:00:00Z"}
                    """;
            default -> throw new IllegalArgumentException("Unexpected path " + path);
        };
    }
}
