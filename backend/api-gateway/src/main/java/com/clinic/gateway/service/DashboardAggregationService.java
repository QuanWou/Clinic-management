package com.clinic.gateway.service;

import com.clinic.gateway.config.ServicesProperties;
import com.clinic.gateway.dto.DashboardResponse;
import com.clinic.gateway.dto.DownstreamApiResponse;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;

@Service
public class DashboardAggregationService {

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

    public DashboardResponse getCurrentUserDashboard(String authorizationHeader) {
        Map<String, Object> user = getObject(servicesProperties.identityUrl(), "/api/users/me", authorizationHeader);
        List<Map<String, Object>> appointments = getList(servicesProperties.appointmentUrl(), "/api/appointments/my", authorizationHeader);
        List<Map<String, Object>> medicalRecords = getList(servicesProperties.medicalRecordUrl(), "/api/medical-records/my", authorizationHeader);
        List<Map<String, Object>> invoices = getList(servicesProperties.billingUrl(), "/api/invoices/my", authorizationHeader);

        return new DashboardResponse(user, appointments, medicalRecords, invoices);
    }

    private Map<String, Object> getObject(String baseUrl, String path, String authorizationHeader) {
        DownstreamApiResponse<Map<String, Object>> response = webClientBuilder.build()
                .get()
                .uri(baseUrl + path)
                .header(HttpHeaders.AUTHORIZATION, authorizationHeader)
                .retrieve()
                .bodyToMono(OBJECT_RESPONSE)
                .block();
        return response == null ? Map.of() : response.data();
    }

    private List<Map<String, Object>> getList(String baseUrl, String path, String authorizationHeader) {
        DownstreamApiResponse<List<Map<String, Object>>> response = webClientBuilder.build()
                .get()
                .uri(baseUrl + path)
                .header(HttpHeaders.AUTHORIZATION, authorizationHeader)
                .retrieve()
                .bodyToMono(LIST_RESPONSE)
                .block();
        return response == null ? List.of() : response.data();
    }
}
