package com.clinic.identity.dto;

import com.clinic.identity.entity.UserStatus;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;

public record AdminUserResponse(UUID id, String email, String fullName, String phone,
                                UserStatus status, Set<String> roles,
                                LocalDateTime createdAt, LocalDateTime updatedAt, String accountCode) {
    public AdminUserResponse(UUID id, String email, String fullName, String phone,
                             UserStatus status, Set<String> roles,
                             LocalDateTime createdAt, LocalDateTime updatedAt) {
        this(id, email, fullName, phone, status, roles, createdAt, updatedAt, null);
    }
}