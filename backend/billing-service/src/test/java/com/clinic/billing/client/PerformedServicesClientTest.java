package com.clinic.billing.client;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class PerformedServicesClientTest {
    private static final String URL = "https://appointments.example.test";
    private MockRestServiceServer server;
    private PerformedServicesClient client;
    private UUID appointmentId;

    @BeforeEach
    void setup() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        client = new PerformedServicesClient(builder, URL);
        appointmentId = UUID.randomUUID();
    }

    @Test
    void readsFinalizedContract() {
        UUID itemId = UUID.randomUUID();
        UUID serviceId = UUID.randomUUID();
        server.expect(requestTo(URL + "/api/appointments/" + appointmentId + "/performed-services"))
                .andExpect(header("Authorization", "Bearer staff"))
                .andRespond(withSuccess("{\"success\":true,\"data\":{\"appointmentId\":\"" + appointmentId
                        + "\",\"finalized\":true,\"revision\":\"r1\",\"items\":[{\"performedItemId\":\""
                        + itemId + "\",\"serviceId\":\"" + serviceId
                        + "\",\"quantity\":1,\"serviceDate\":\"2026-09-20\"}]}}", MediaType.APPLICATION_JSON));

        var response = client.get("Bearer staff", appointmentId);

        assertEquals("r1", response.revision());
        assertEquals(itemId, response.items().getFirst().performedItemId());
        server.verify();
    }

    @Test
    void mismatchedAppointmentFailsClosed() {
        server.expect(requestTo(URL + "/api/appointments/" + appointmentId + "/performed-services"))
                .andRespond(withSuccess("{\"success\":true,\"data\":{\"appointmentId\":\"" + UUID.randomUUID()
                        + "\",\"finalized\":true,\"revision\":\"r1\",\"items\":[]}}", MediaType.APPLICATION_JSON));
        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> client.get("Bearer staff", appointmentId)).getErrorCode());
    }

    @Test
    void unavailableApiFailsClosed() {
        server.expect(requestTo(URL + "/api/appointments/" + appointmentId + "/performed-services"))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> client.get("Bearer staff", appointmentId)).getErrorCode());
    }
}
