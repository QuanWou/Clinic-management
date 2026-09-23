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
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Sort;

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
    void resolvesPublicPatientCodeToTheExistingPatientId() {
        UUID id = UUID.randomUUID();
        Patient patient = Patient.builder().id(id).fullName("Đặng Gia Phong").build();
        patient.setPatientCode("BN000513");
        when(repository.findByPatientCode("BN000513")).thenReturn(java.util.Optional.of(patient));
        var resolved = service.getByCode(" bn000513 ");
        assertEquals(id, resolved.id());
        assertEquals("BN000513", resolved.patientCode());
        verify(repository).findByPatientCode("BN000513");
    }

    @Test
    void rejectsMalformedCodesWithoutConsultingTheDirectory() {
        assertEquals(ErrorCode.VALIDATION_ERROR,
                assertThrows(BusinessException.class, () -> service.getByCode("e2000000-0000-4000-8000-000000000499")).getErrorCode());
        assertEquals(ErrorCode.VALIDATION_ERROR,
                assertThrows(BusinessException.class, () -> service.getByCode("BN00051%_")).getErrorCode());
        verifyNoInteractions(repository);
    }

    @Test
    void escapesWildcardCharactersInPatientName() {
        when(repository.searchForReception(null, "%anh!%!_%", PageRequest.of(0, 50)))
                .thenReturn(List.of());
        assertTrue(service.search(null, "Anh%_").isEmpty());
        verify(repository).searchForReception(null, "%anh!%!_%", PageRequest.of(0, 50));
    }

    @Test
    void staffDirectoryReturnsPagedPatientNamesAndTotalWithoutSearchTerms() {
        Patient patient = Patient.builder().id(UUID.randomUUID()).fullName("Nguyễn Thị An").phone("0900000000").build();
        var pageable = PageRequest.of(1, 20, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        when(repository.findAll(pageable)).thenReturn(new PageImpl<>(List.of(patient), pageable, 41));
        var page = service.list(1, 20);
        assertEquals(41, page.getTotalElements());
        assertEquals(1, page.getNumber());
        assertEquals("Nguyễn Thị An", page.getContent().get(0).fullName());
        verify(repository).findAll(pageable);
    }

    @Test
    void rejectsUnboundedOrInvalidDirectoryRequests() {
        assertEquals(ErrorCode.VALIDATION_ERROR,
                assertThrows(BusinessException.class, () -> service.list(0, 1000)).getErrorCode());
        assertEquals(ErrorCode.VALIDATION_ERROR,
                assertThrows(BusinessException.class, () -> service.list(-1, 20)).getErrorCode());
        verifyNoInteractions(repository);
    }
}