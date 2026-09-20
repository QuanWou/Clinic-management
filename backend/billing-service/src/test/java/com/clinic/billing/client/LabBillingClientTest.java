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

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class LabBillingClientTest {
    private static final String URL = "https://lab.example.test";
    private MockRestServiceServer server;
    private LabBillingClient client;
    private UUID appointmentId;

    @BeforeEach void setup() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        client = new LabBillingClient(builder, URL);
        appointmentId = UUID.randomUUID();
    }

    private void expect(String body) {
        server.expect(requestTo(URL + "/api/medical-records/appointments/" + appointmentId + "/billable-items"))
                .andExpect(header("Authorization", "Bearer staff"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
    }

    @Test void readsActualTask04ContractIncludingPendingOrders() {
        expect("{\"success\":true,\"data\":{\"appointmentId\":\"" + appointmentId
                + "\",\"items\":[{\"orderId\":\"" + UUID.randomUUID()
                + "\",\"testCode\":\"CBC\",\"quantity\":1,\"status\":\"ORDERED\",\"billableAt\":null}]}}");
        var data = client.get("Bearer staff", appointmentId);
        assertEquals(1, data.items().size()); assertEquals("ORDERED", data.items().get(0).status());
        server.verify();
    }

    @Test void readsFinalizedFreezeMetadataAndCatalogIdentity() {
        UUID orderId = UUID.randomUUID();
        UUID serviceId = UUID.randomUUID();
        expect("{\"success\":true,\"data\":{\"appointmentId\":\"" + appointmentId
                + "\",\"finalizedForBilling\":true,\"billableRevision\":\"lab-r1\",\"items\":[{\"orderId\":\""
                + orderId + "\",\"testCode\":\"CBC\",\"quantity\":1,\"status\":\"RELEASED\","
                + "\"billableAt\":\"2026-09-20T09:00:00\",\"serviceId\":\"" + serviceId
                + "\",\"performedOn\":\"2026-09-20\"}]}}");

        var data = client.get("Bearer staff", appointmentId);

        assertTrue(data.finalizedForBilling());
        assertEquals("lab-r1", data.billableRevision());
        assertEquals(serviceId, data.items().getFirst().serviceId());
        server.verify();
    }

    @Test void mismatchedAppointmentFailsClosed() {
        expect("{\"success\":true,\"data\":{\"appointmentId\":\"" + UUID.randomUUID() + "\",\"items\":[]}}");
        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> client.get("Bearer staff", appointmentId)).getErrorCode());
        server.verify();
    }

    @Test void absentLabApiDoesNotBecomeEmptyList() {
        server.expect(requestTo(URL + "/api/medical-records/appointments/" + appointmentId + "/billable-items"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND));
        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> client.get("Bearer staff", appointmentId)).getErrorCode());
        server.verify();
    }

    @Test void nullItemListFailsClosed() {
        expect("{\"success\":true,\"data\":{\"appointmentId\":\"" + appointmentId + "\"}}");
        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> client.get("Bearer staff", appointmentId)).getErrorCode());
        server.verify();
    }
}
