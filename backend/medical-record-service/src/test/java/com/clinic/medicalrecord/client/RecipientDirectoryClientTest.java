package com.clinic.medicalrecord.client;

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

class RecipientDirectoryClientTest {
    private static final String BASE = "https://patients.example.test";
    private MockRestServiceServer server;
    private RecipientDirectoryClient client;
    private UUID patientId;

    @BeforeEach
    void setup() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        client = new RecipientDirectoryClient(builder, BASE, "test-service-key");
        patientId = UUID.randomUUID();
    }

    private void reply(String data) {
        server.expect(requestTo(BASE + "/internal/patients/" + patientId + "/recipient"))
                .andExpect(header("X-Internal-Service-Key", "test-service-key"))
                .andRespond(withSuccess("{\"success\":true,\"data\":" + data + "}", MediaType.APPLICATION_JSON));
    }

    @Test
    void linkedUserIsReturnedOnlyForMatchingPatient() {
        UUID userId = UUID.randomUUID();
        reply("{\"patientId\":\"" + patientId + "\",\"userId\":\"" + userId + "\"}");
        assertEquals(userId, client.findLinkedUser(patientId).orElseThrow());
        server.verify();
    }

    @Test
    void verifiedWalkInWithoutAccountIsExplicitlyEmpty() {
        reply("{\"patientId\":\"" + patientId + "\",\"userId\":null}");
        assertTrue(client.findLinkedUser(patientId).isEmpty());
        server.verify();
    }

    @Test
    void mismatchedPatientNeverLooksLikeWalkIn() {
        reply("{\"patientId\":\"" + UUID.randomUUID() + "\",\"userId\":null}");
        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> client.findLinkedUser(patientId)).getErrorCode());
        server.verify();
    }

    @Test
    void unavailableDirectoryNeverLooksLikeWalkIn() {
        server.expect(requestTo(BASE + "/internal/patients/" + patientId + "/recipient"))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> client.findLinkedUser(patientId)).getErrorCode());
        server.verify();
    }
}