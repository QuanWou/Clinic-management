package com.clinic.gateway.controller;

import com.clinic.common.dto.ApiResponse;
import com.clinic.gateway.dto.DashboardResponse;
import com.clinic.gateway.service.DashboardAggregationService;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardAggregationService dashboardAggregationService;

    public DashboardController(DashboardAggregationService dashboardAggregationService) {
        this.dashboardAggregationService = dashboardAggregationService;
    }

    @GetMapping("/me")
    public Mono<ApiResponse<DashboardResponse>> getCurrentUserDashboard(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader
    ) {
        return dashboardAggregationService.getCurrentUserDashboard(authorizationHeader)
                .map(dashboard -> ApiResponse.success("Success", dashboard));
    }
}
