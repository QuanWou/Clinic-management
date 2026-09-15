package com.clinic.gateway.dto;

import java.util.List;
import java.util.Map;

public record DashboardResponse(
        Map<String, Object> user,
        List<Map<String, Object>> appointments,
        List<Map<String, Object>> medicalRecords,
        List<Map<String, Object>> invoices
) {
}
