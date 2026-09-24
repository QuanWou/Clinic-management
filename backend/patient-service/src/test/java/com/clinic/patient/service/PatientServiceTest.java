package com.clinic.patient.service;

import com.clinic.common.exception.BusinessException;
import com.clinic.patient.dto.PatientProfileResponse;
import com.clinic.patient.dto.UpdatePatientRequest;
import com.clinic.patient.entity.Patient;
import com.clinic.patient.repository.PatientRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PatientServiceTest {

    @Mock
    private PatientRepository patientRepository;

    private PatientService patientService;

    @BeforeEach
    void setUp() {
        patientService = new PatientService(patientRepository);
    }

    @Test
    void updateProfileCreatesAndNormalizesNewPatientProfile() {
        UUID userId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UpdatePatientRequest request = new UpdatePatientRequest(
                LocalDate.of(1995, 4, 12),
                "female",
                "  12 Nguyen Trai Street  ",
                "ab+"
        );
        when(patientRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(patientRepository.save(any(Patient.class))).thenAnswer(invocation -> {
            Patient patient = invocation.getArgument(0);
            patient.setId(patientId);
            return patient;
        });

        PatientProfileResponse response = patientService.updateProfile(userId, request);

        assertThat(response.id()).isEqualTo(patientId);
        assertThat(response.userId()).isEqualTo(userId);
        assertThat(response.gender()).isEqualTo("FEMALE");
        assertThat(response.address()).isEqualTo("12 Nguyen Trai Street");
        assertThat(response.bloodType()).isEqualTo("AB+");
        verify(patientRepository).save(any(Patient.class));
    }

    @Test
    void updateProfileReusesExistingPatientAndClearsOptionalBlankFields() {
        UUID userId = UUID.randomUUID();
        Patient existing = Patient.builder()
                .id(UUID.randomUUID())
                .userId(userId)
                .address("Old address")
                .bloodType("O+")
                .build();
        when(patientRepository.findByUserId(userId)).thenReturn(Optional.of(existing));
        when(patientRepository.save(existing)).thenReturn(existing);

        PatientProfileResponse response = patientService.updateProfile(
                userId,
                new UpdatePatientRequest(LocalDate.of(1988, 1, 2), "MALE", "   ", null)
        );

        assertThat(response.id()).isEqualTo(existing.getId());
        assertThat(response.address()).isNull();
        assertThat(response.bloodType()).isNull();
    }

    @Test
    void getProfileRejectsMissingPatientProfile() {
        UUID userId = UUID.randomUUID();
        when(patientRepository.findByUserId(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> patientService.getProfile(userId))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Patient profile not found");
    }
}
