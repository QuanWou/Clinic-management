package com.clinic.gateway.dto;

import java.time.Instant;

public record DownstreamApiResponse<T>(
        boolean success,
        String message,
        T data,
        Instant timestamp
) {
}
