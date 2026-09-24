package com.clinic.identity.service;

import com.clinic.identity.dto.*;
import com.clinic.identity.entity.RoleCode;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface AdminUserService {
    Page<AdminUserResponse> list(Pageable pageable);
    AdminUserResponse get(UUID id);
    AdminUserResponse create(UUID actorId, CreateAdminUserRequest request);
    AdminUserResponse update(UUID actorId, UUID id, UpdateAdminUserRequest request);
    AdminUserResponse setStatus(UUID actorId, UUID id, UpdateUserStatusRequest request);
    AdminUserResponse setRoles(UUID actorId, UUID id, UpdateUserRolesRequest request);
    AdminUserResponse grantRole(UUID actorId, UUID id, RoleCode role);
    AdminUserResponse revokeRole(UUID actorId, UUID id, RoleCode role);
}