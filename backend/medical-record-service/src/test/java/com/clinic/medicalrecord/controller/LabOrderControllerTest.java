package com.clinic.medicalrecord.controller;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.medicalrecord.dto.CreateLabOrderRequest;
import com.clinic.medicalrecord.security.CurrentUserPrincipal;
import com.clinic.medicalrecord.service.LabOrderService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** HTTP mapping/validation tests; role authorization itself is tested in the service tests. */
class LabOrderControllerTest {
    private MockMvc mvc;
    private LocalValidatorFactoryBean validator;
    private LabOrderService service;
    private CurrentUserPrincipal doctor;

    @BeforeEach
    void setUp() {
        doctor = new CurrentUserPrincipal(UUID.randomUUID(), "doctor@test.com", "Doctor", Set.of("ROLE_DOCTOR"));
        service = mock(LabOrderService.class);
        validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        mvc = MockMvcBuilders.standaloneSetup(new LabOrderController(service))
                .setControllerAdvice(new com.clinic.medicalrecord.exception.GlobalExceptionHandler())
                .setValidator(validator)
                .setCustomArgumentResolvers(new HandlerMethodArgumentResolver() {
                    @Override
                    public boolean supportsParameter(MethodParameter parameter) {
                        return parameter.hasParameterAnnotation(AuthenticationPrincipal.class);
                    }

                    @Override
                    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer container,
                                                  NativeWebRequest request, WebDataBinderFactory binderFactory) {
                        return doctor;
                    }
                })
                .build();
    }

    @AfterEach
    void closeValidator() {
        validator.close();
    }

    @Test
    void unauthorizedClinicalResultReturns403() throws Exception {
        UUID orderId = UUID.randomUUID();
        when(service.get(any(), eq("Bearer token"), eq(orderId)))
                .thenThrow(new BusinessException(ErrorCode.FORBIDDEN, "No clinical relationship"));

        mvc.perform(get("/api/medical-records/lab-orders/{id}", orderId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value(ErrorCode.FORBIDDEN));
    }

    @Test
    void invalidLabOrderBodyReturns400() throws Exception {
        mvc.perform(post("/api/medical-records/{id}/lab-orders", UUID.randomUUID())
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"testCode\":\"\",\"testName\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(ErrorCode.VALIDATION_ERROR));
    }

    @Test
    void duplicateOrderTransitionReturns409() throws Exception {
        UUID orderId = UUID.randomUUID();
        when(service.release(any(), eq("Bearer token"), eq(orderId)))
                .thenThrow(new BusinessException(ErrorCode.CONFLICT, "Already released"));

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                                "/api/medical-records/lab-orders/{id}/release", orderId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value(ErrorCode.CONFLICT));
    }

    @Test
    void optimisticLockConflictReturns409WithoutClinicalDetails() throws Exception {
        UUID orderId = UUID.randomUUID();
        when(service.release(any(), eq("Bearer token"), eq(orderId)))
                .thenThrow(new org.springframework.orm.ObjectOptimisticLockingFailureException(Object.class, orderId));

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                                "/api/medical-records/lab-orders/{id}/release", orderId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value(ErrorCode.CONFLICT));
    }

    @Test
    void databaseUniqueSampleConflictReturns409() throws Exception {
        UUID orderId = UUID.randomUUID();
        when(service.collect(any(), eq("Bearer token"), eq(orderId), any()))
                .thenThrow(new org.springframework.dao.DataIntegrityViolationException("sample duplicate"));

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                                "/api/medical-records/lab-orders/{id}/sample", orderId)
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sampleIdentifier\":\"S001\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value(ErrorCode.CONFLICT));
    }

    @Test
    void billingStatusReturnsOnlyRecordIdAndFinalizedFlagForAuthorizedDoctor() throws Exception {
        UUID recordId = UUID.randomUUID();
        when(service.isBillingFinalized(any(), eq("Bearer token"), eq(recordId))).thenReturn(true);

        mvc.perform(get("/api/medical-records/{recordId}/lab-orders/billing-status", recordId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.medicalRecordId").value(recordId.toString()))
                .andExpect(jsonPath("$.data.finalizedForBilling").value(true))
                .andExpect(jsonPath("$.data.items").doesNotExist())
                .andExpect(jsonPath("$.data.patientId").doesNotExist());
    }

    @Test
    void billingStatusRejectsDoctorWithoutRecordOwnership() throws Exception {
        UUID recordId = UUID.randomUUID();
        when(service.isBillingFinalized(any(), eq("Bearer token"), eq(recordId)))
                .thenThrow(new BusinessException(ErrorCode.FORBIDDEN, "No treating-doctor relationship"));

        mvc.perform(get("/api/medical-records/{recordId}/lab-orders/billing-status", recordId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value(ErrorCode.FORBIDDEN));
    }
}