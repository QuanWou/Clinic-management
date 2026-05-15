package com.clinic.appointment.client;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.LocalTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withResourceNotFound;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class DoctorClientTest {

    @Test
    void getAvailabilityShouldUnwrapApiResponse() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        DoctorClient client = new DoctorClient(builder, "http://doctor-service");
        UUID doctorId = UUID.randomUUID();
        String responseBody = """
                {
                  "success": true,
                  "message": "Doctor availability retrieved successfully",
                  "data": {
                    "doctorId": "%s",
                    "available": true,
                    "dayOfWeek": 1,
                    "startTime": "09:00:00",
                    "endTime": "10:00:00"
                  },
                  "timestamp": "2026-05-14T00:00:00Z"
                }
                """.formatted(doctorId);

        server.expect(requestTo("http://doctor-service/api/doctors/%s/availability?dayOfWeek=1&startTime=09:00&endTime=10:00".formatted(doctorId)))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer token"))
                .andRespond(withSuccess(responseBody, MediaType.APPLICATION_JSON));

        DoctorAvailabilityResponse response = client.getAvailability(
                "Bearer token",
                doctorId,
                1,
                LocalTime.of(9, 0),
                LocalTime.of(10, 0)
        );

        assertEquals(doctorId, response.doctorId());
        assertTrue(response.available());
        assertEquals(LocalTime.of(9, 0), response.startTime());
        assertEquals(LocalTime.of(10, 0), response.endTime());
        server.verify();
    }

    @Test
    void getAvailabilityShouldMapNotFoundResponse() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        DoctorClient client = new DoctorClient(builder, "http://doctor-service");
        UUID doctorId = UUID.randomUUID();

        server.expect(requestTo("http://doctor-service/api/doctors/%s/availability?dayOfWeek=1&startTime=09:00&endTime=10:00".formatted(doctorId)))
                .andRespond(withResourceNotFound());

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> client.getAvailability("Bearer token", doctorId, 1, LocalTime.of(9, 0), LocalTime.of(10, 0))
        );

        assertEquals(ErrorCode.RESOURCE_NOT_FOUND, exception.getErrorCode());
        server.verify();
    }
}
