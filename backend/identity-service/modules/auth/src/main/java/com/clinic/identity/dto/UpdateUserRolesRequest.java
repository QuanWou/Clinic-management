package com.clinic.identity.dto;

import com.clinic.identity.entity.RoleCode;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.Set;

public record UpdateUserRolesRequest(@NotEmpty Set<@NotNull RoleCode> roles) {
}