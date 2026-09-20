package com.clinic.gateway.service;

import com.clinic.gateway.config.ServicesProperties;
import com.clinic.gateway.dto.DashboardResponse;
import com.clinic.gateway.dto.DownstreamApiResponse;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Collection;
import java.util.List;
import java.util.Map;

@Service
public class DashboardAggregationService {

    private static final String PATIENT_ROLE = "ROLE_PATIENT";
    private static final ParameterizedTypeReference<DownstreamApiResponse<Map<String, Object>>> OBJECT_RESPONSE = new ParameterizedTypeReference<>() {
    };
    private static final ParameterizedTypeReference<DownstreamApiResponse<List<Map<String, Object>>>> LIST_RESPONSE = new ParameterizedTypeReference<>() {
    };

    private final WebClient.Builder webClientBuilder;
    private final ServicesProperties servicesProperties;

    public DashboardAggregationService(WebClient.Builder webClientBuilder, ServicesProperties servicesProperties) {
        this.webClientBuilder = webClientBuilder;
        this.servicesProperties = servicesProperties;
    }

    public Mono<DashboardResponse> getCurrentUserDashboard(String authorizationHeader) {
        return getObject(servicesProperties.identityUrl(), "/api/users/me", authorizationHeader)
                .flatMap(user -> {
                    if (!hasRole(user, PATIENT_ROLE)) {
                        return Mono.just(new DashboardResponse(user, List.of(), List.of(), List.of()));
                    }

                    Mono<List<Map<String, Object>>> appointments = getList(
                            servicesProperties.appointmentUrl(), "/api/appointments/my", authorizationHeader);
                    Mono<List<Map<String, Object>>> medicalRecords = getList(
                            servicesProperties.medicalRecordUrl(), "/api/medical-records/my", authorizationHeader);
                    Mono<List<Map<String, Object>>> invoices = getList(
                            servicesProperties.billingUrl(), "/api/invoices/my", authorizationHeader);

                    return Mono.zip(appointments, medicalRecords, invoices)
                            .map(results -> new DashboardResponse(
                                    user,
                                    results.getT1(),
                                    results.getT2(),
                                    results.getT3()
                            ));
                });
    }

    private Mono<Map<String, Object>> getObject(String baseUrl, String path, String authorizationHeader) {
        return webClientBuilder.build()
                .get()
                .uri(baseUrl + path)
                .header(HttpHeaders.AUTHORIZATION, authorizationHeader)
                .retrieve()
                .bodyToMono(OBJECT_RESPONSE)
                .map(response -> response.data() == null ? Map.<String, Object>of() : response.data())
                .defaultIfEmpty(Map.of());
    }

    private Mono<List<Map<String, Object>>> getList(
            String baseUrl,
            String path,
            String authorizationHeader
    ) {
        return webClientBuilder.build()
                .get()
                .uri(baseUrl + path)
                .header(HttpHeaders.AUTHORIZATION, authorizationHeader)
                .retrieve()
                .bodyToMono(LIST_RESPONSE)
                .switchIfEmpty(Mono.error(new IllegalStateException("Dashboard downstream response is missing")))
                .map(response -> {
                    if (response.data() == null) {
                        throw new IllegalStateException("Dashboard downstream data is missing");
                    }
                    return response.data();
                });
    }

    private boolean hasRole(Map<String, Object> user, String expectedRole) {
        Object roles = user.get("roles");
        if (!(roles instanceof Collection<?> roleCollection)) {
            return false;
        }

        return roleCollection.stream().anyMatch(role -> expectedRole.equals(roleName(role)));
    }

    private String roleName(Object role) {
        if (role instanceof String roleName) {
            return roleName;
        }
        if (role instanceof Map<?, ?> roleMap) {
            Object code = roleMap.get("code");
            return code == null ? String.valueOf(roleMap.get("name")) : String.valueOf(code);
        }
        return String.valueOf(role);
    }
}
