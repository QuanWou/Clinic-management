package com.clinic.identity.controller;

import com.clinic.common.dto.ApiResponse;
import com.clinic.identity.dto.*;
import com.clinic.identity.entity.RoleCode;
import com.clinic.identity.security.CurrentUserPrincipal;
import com.clinic.identity.service.AdminUserService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/users/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {
    private final AdminUserService service;

    public AdminUserController(AdminUserService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<Page<AdminUserResponse>> list(Pageable pageable) {
        return ApiResponse.success(service.list(pageable));
    }

    @GetMapping("/{id}")
    public ApiResponse<AdminUserResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(service.get(id));
    }

    @PostMapping
    public ApiResponse<AdminUserResponse> create(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                  @Valid @RequestBody CreateAdminUserRequest request) {
        return ApiResponse.success("User created", service.create(principal.id(), request));
    }

    @PutMapping("/{id}")
    public ApiResponse<AdminUserResponse> update(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                  @PathVariable UUID id,
                                                  @Valid @RequestBody UpdateAdminUserRequest request) {
        return ApiResponse.success("User updated", service.update(principal.id(), id, request));
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<AdminUserResponse> status(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                  @PathVariable UUID id,
                                                  @Valid @RequestBody UpdateUserStatusRequest request) {
        return ApiResponse.success("Status updated", service.setStatus(principal.id(), id, request));
    }

    @PutMapping("/{id}/roles")
    public ApiResponse<AdminUserResponse> roles(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                 @PathVariable UUID id,
                                                 @Valid @RequestBody UpdateUserRolesRequest request) {
        return ApiResponse.success("Roles updated", service.setRoles(principal.id(), id, request));
    }

    @PostMapping("/{id}/roles/{role}")
    public ApiResponse<AdminUserResponse> grant(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                 @PathVariable UUID id, @PathVariable RoleCode role) {
        return ApiResponse.success("Role granted", service.grantRole(principal.id(), id, role));
    }

    @DeleteMapping("/{id}/roles/{role}")
    public ApiResponse<AdminUserResponse> revoke(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                  @PathVariable UUID id, @PathVariable RoleCode role) {
        return ApiResponse.success("Role revoked", service.revokeRole(principal.id(), id, role));
    }
}