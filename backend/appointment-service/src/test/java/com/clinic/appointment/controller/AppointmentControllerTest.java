package com.clinic.appointment.controller;

import com.clinic.appointment.client.DoctorClient;
import com.clinic.appointment.client.PatientClient;
import com.clinic.appointment.dto.AppointmentResponse;
import com.clinic.appointment.dto.CreateAppointmentRequest;
import com.clinic.appointment.entity.AppointmentStatus;
import com.clinic.appointment.security.CurrentUserPrincipal;
import com.clinic.appointment.security.JwtAuthenticationFilter;
import com.clinic.appointment.security.JwtService;
import com.clinic.appointment.service.AppointmentService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import java.util.List;

@WebMvcTest(AppointmentController.class)
@AutoConfigureMockMvc(addFilters = false)
class AppointmentControllerTest implements WebMvcConfigurer {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AppointmentService appointmentService;

    @MockBean
    private PatientClient patientClient;

    @MockBean
    private DoctorClient doctorClient;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(new HandlerMethodArgumentResolver() {
            @Override
            public boolean supportsParameter(org.springframework.core.MethodParameter parameter) {
                return parameter.getParameterType().equals(CurrentUserPrincipal.class);
            }

            @Override
            public Object resolveArgument(org.springframework.core.MethodParameter parameter,
                                          org.springframework.web.method.support.ModelAndViewContainer mavContainer,
                                          org.springframework.web.context.request.NativeWebRequest webRequest,
                                          org.springframework.web.bind.support.WebDataBinderFactory binderFactory) {
                return new CurrentUserPrincipal(UUID.fromString("00000000-0000-0000-0000-000000000000"), "test@test.com", "Test", Set.of("PATIENT", "DOCTOR"));
            }
        });
    }

    @Test
    void create_ShouldReturn200_WhenValidRequest() throws Exception {
        UUID currentUserId = UUID.fromString("00000000-0000-0000-0000-000000000000");
        UUID doctorId = UUID.randomUUID();
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                doctorId,
                LocalDate.now().plusDays(1),
                LocalTime.of(9, 0),
                LocalTime.of(10, 0),
                "Checkup"
        );

        AppointmentResponse response = new AppointmentResponse(
                UUID.randomUUID(),
                currentUserId,
                doctorId,
                request.appointmentDate(),
                request.startTime(),
                request.endTime(),
                AppointmentStatus.PENDING,
                request.reason(),
                LocalDateTime.now(),
                LocalDateTime.now()
        );

        when(appointmentService.create(eq(currentUserId), any(), any(CurrentUserPrincipal.class), any())).thenReturn(response);

        CurrentUserPrincipal principal = new CurrentUserPrincipal(currentUserId, "test@test.com", "Test", Set.of("PATIENT"));
        Authentication auth = new UsernamePasswordAuthenticationToken(principal, null, Set.of(new SimpleGrantedAuthority("ROLE_PATIENT")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        mockMvc.perform(post("/api/appointments")
                        .with(authentication(auth))
                        .header("Authorization", "Bearer fake-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.doctorId").value(doctorId.toString()));
    }

    @Test
    void create_ShouldReturn400_WhenRequestInvalid() throws Exception {
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                null, // missing doctor ID
                LocalDate.now().plusDays(1),
                LocalTime.of(9, 0),
                LocalTime.of(10, 0),
                "Checkup"
        );

        CurrentUserPrincipal principal = new CurrentUserPrincipal(UUID.randomUUID(), "test@test.com", "Test", Set.of("PATIENT"));
        Authentication auth = new UsernamePasswordAuthenticationToken(principal, null, Set.of(new SimpleGrantedAuthority("ROLE_PATIENT")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        mockMvc.perform(post("/api/appointments")
                        .with(authentication(auth))
                        .header("Authorization", "Bearer fake-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_ERROR"));
    }

    @Test
    void confirm_ShouldReturn200() throws Exception {
        UUID currentUserId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();

        AppointmentResponse response = new AppointmentResponse(
                appointmentId,
                UUID.randomUUID(),
                UUID.randomUUID(),
                LocalDate.now().plusDays(1),
                LocalTime.of(9, 0),
                LocalTime.of(10, 0),
                AppointmentStatus.CONFIRMED,
                "Checkup",
                LocalDateTime.now(),
                LocalDateTime.now()
        );

        when(appointmentService.confirm(eq(currentUserId), any(), any(CurrentUserPrincipal.class), eq(appointmentId))).thenReturn(response);

        CurrentUserPrincipal principal = new CurrentUserPrincipal(currentUserId, "doctor@test.com", "Doctor", Set.of("DOCTOR"));
        Authentication auth = new UsernamePasswordAuthenticationToken(principal, null, Set.of(new SimpleGrantedAuthority("ROLE_DOCTOR")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        mockMvc.perform(patch("/api/appointments/{id}/confirm", appointmentId)
                        .header("Authorization", "Bearer fake-token")
                        .with(authentication(auth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("CONFIRMED"));
    }
}
