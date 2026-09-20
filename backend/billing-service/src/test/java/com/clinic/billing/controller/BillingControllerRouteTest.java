package com.clinic.billing.controller;

import com.clinic.billing.service.BillingService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.UUID;

import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class BillingControllerRouteTest {
    @Test
    void legacyPatchPayEndpointIsNotMapped() throws Exception {
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new BillingController(mock(BillingService.class))).build();
        mvc.perform(patch("/api/invoices/" + UUID.randomUUID() + "/pay")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"CARD\"}"))
                .andExpect(status().isNotFound());
    }
}