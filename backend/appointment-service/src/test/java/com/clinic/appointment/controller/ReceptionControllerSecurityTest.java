package com.clinic.appointment.controller;

import com.clinic.appointment.client.DoctorClient;
import com.clinic.appointment.client.PatientClient;
import com.clinic.appointment.security.JwtAuthenticationFilter;
import com.clinic.appointment.security.JwtService;
import com.clinic.appointment.service.ReceptionQueueService;
import com.clinic.appointment.service.ReceptionSchedulingService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.time.LocalDate;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest({ReceptionQueueController.class, ReceptionSchedulingController.class})
@AutoConfigureMockMvc(addFilters = false)
@Import(ReceptionControllerSecurityTest.MethodSecurity.class)
class ReceptionControllerSecurityTest {
    @TestConfiguration
    @EnableMethodSecurity
    static class MethodSecurity {}

    @Autowired MockMvc mvc;
    @MockBean ReceptionQueueService queues;
    @MockBean ReceptionSchedulingService scheduling;
    @MockBean PatientClient patientClient;
    @MockBean DoctorClient doctorClient;
    @MockBean JwtService jwtService;
    @MockBean JwtAuthenticationFilter jwtFilter;

    @Test
    @WithMockUser(roles = "PATIENT")
    void patientCannotReadStaffQueue() throws Exception {
        mvc.perform(get("/api/appointments/reception/queue").header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(queues);
    }

    @Test
    @WithMockUser(roles = "PATIENT")
    void patientCannotBookForAnotherPatient() throws Exception {
        String validRequest = """
                {"patientId":"00000000-0000-0000-0000-000000000001",
                 "doctorId":"00000000-0000-0000-0000-000000000002",
                 "appointmentDate":"%s", "startTime":"09:00:00",
                 "endTime":"10:00:00", "reason":"Checkup"}
                """.formatted(LocalDate.now().plusDays(1));
        mvc.perform(post("/api/appointments/reception/bookings").header("Authorization", "Bearer token")
                        .contentType("application/json").content(validRequest))
                .andExpect(status().isForbidden());
        verifyNoInteractions(scheduling);
    }

    @Test
    @WithMockUser(roles = "DOCTOR")
    void doctorCannotCheckInPatients() throws Exception {
        mvc.perform(post("/api/appointments/reception/00000000-0000-0000-0000-000000000001/check-in"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(queues);
    }

    @Test
    @WithMockUser(roles = "RECEPTIONIST")
    void receptionistCanViewBookings() throws Exception {
        when(scheduling.list(null, null)).thenReturn(List.of());
        mvc.perform(get("/api/appointments/reception/bookings"))
                .andExpect(status().isOk());
        verify(scheduling).list(null, null);
    }

    @Test
    @WithMockUser(roles = "PATIENT")
    void patientCannotCancelStaffBooking() throws Exception {
        mvc.perform(patch("/api/appointments/reception/00000000-0000-0000-0000-000000000001/cancel"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(scheduling);
    }
}