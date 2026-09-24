package com.clinic.patient.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class UpdatePatientRequestValidationTest {

    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void acceptsCompleteProfileWithOptionalFieldsOmitted() {
        UpdatePatientRequest request = new UpdatePatientRequest(
                LocalDate.of(1990, 6, 15),
                "other",
                null,
                null
        );

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void rejectsMissingRequiredFieldsAndUnsupportedValues() {
        UpdatePatientRequest request = new UpdatePatientRequest(
                null,
                "UNKNOWN",
                "A".repeat(501),
                "Z+"
        );

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("dob", "gender", "address", "bloodType");
    }

    @Test
    void rejectsTodayAsDateOfBirth() {
        UpdatePatientRequest request = new UpdatePatientRequest(LocalDate.now(), "MALE", null, null);

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("dob");
    }
}
