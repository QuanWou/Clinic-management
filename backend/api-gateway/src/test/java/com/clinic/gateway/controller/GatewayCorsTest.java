package com.clinic.gateway.controller;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.reactive.server.WebTestClient;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class GatewayCorsTest {

    @LocalServerPort
    private int port;

    @Test
    void routedApiAcceptsFrontendPreflight() {
        assertPreflightAllowed("/api/users/me");
    }

    @Test
    void dashboardControllerAcceptsFrontendPreflight() {
        assertPreflightAllowed("/api/dashboard/me");
    }

    private void assertPreflightAllowed(String path) {
        WebTestClient.bindToServer().baseUrl("http://localhost:" + port).build()
                .options().uri(path)
                .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET")
                .exchange()
                .expectStatus().isOk()
                .expectHeader().valueEquals(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:5173")
                .expectHeader().value(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, methods -> assertThat(methods).contains("GET"));
    }
}
