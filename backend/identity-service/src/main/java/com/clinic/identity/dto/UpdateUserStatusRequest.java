package com.clinic.identity.dto;

import com.clinic.identity.entity.UserStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateUserStatusRequest(@NotNull UserStatus status) {
}