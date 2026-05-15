package com.clinic.gateway.controller;

import com.clinic.common.dto.ApiResponse;
import com.clinic.gateway.dto.DashboardResponse;
import com.clinic.gateway.service.DashboardAggregationService;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardAggregationService dashboardAggregationService;

    public DashboardController(DashboardAggregationService dashboardAggregationService) {
        this.dashboardAggregationService = dashboardAggregationService;
    }

    @GetMapping("/me")
    public ApiResponse<DashboardResponse> getCurrentUserDashboard(@RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader) {
        return ApiResponse.success("Success", dashboardAggregationService.getCurrentUserDashboard(authorizationHeader));
    }
}
