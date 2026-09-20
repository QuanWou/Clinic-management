package com.clinic.patient.service;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.patient.dto.RegisterWalkInPatientRequest;
import com.clinic.patient.entity.Patient;
import com.clinic.patient.repository.PatientRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReceptionPatientServiceTest {
    @Mock PatientRepository repository;
    @InjectMocks ReceptionPatientService service;

    @Test
    void registersWalkInWithoutForgingAnIdentityUserId() {
        var request = new RegisterWalkInPatientRequest("  Nguyen Van A  ", " 0912345678 ",
                LocalDate.of(1995, 1, 1), "MALE", "HN", null);
        when(repository.save(any())).thenAnswer(invocation -> {
            Patient p = invocation.getArgument(0);
            assertNull(p.getUserId());
            p.setId(UUID.randomUUID());
            return p;
        });

        var response = service.register(request);

        assertEquals("Nguyen Van A", response.fullName());
        assertEquals("0912345678", response.phone());
        assertNull(response.userId());
    }

    @Test
    void requiresPatientSearchTerm() {
        BusinessException error = assertThrows(BusinessException.class, () -> service.search(" ", null));
        assertEquals(ErrorCode.VALIDATION_ERROR, error.getErrorCode());
        verifyNoInteractions(repository);
    }

    @Test
    void escapesWildcardCharactersInPatientName() {
        when(repository.searchForReception(null, "%anh!%!_%", PageRequest.of(0, 50)))
                .thenReturn(List.of());
        assertTrue(service.search(null, "Anh%_").isEmpty());
        verify(repository).searchForReception(null, "%anh!%!_%", PageRequest.of(0, 50));
    }
}