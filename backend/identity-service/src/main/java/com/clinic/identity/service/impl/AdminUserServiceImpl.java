package com.clinic.identity.service.impl;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.identity.dto.*;
import com.clinic.identity.entity.*;
import com.clinic.identity.repository.*;
import com.clinic.identity.service.AdminUserService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class AdminUserServiceImpl implements AdminUserService {
    private final UserRepository users;
    private final RoleRepository roles;
    private final RefreshTokenRepository refreshTokens;
    private final AdminAuditRepository audits;
    private final PasswordEncoder encoder;

    public AdminUserServiceImpl(UserRepository users, RoleRepository roles,
                                RefreshTokenRepository refreshTokens, AdminAuditRepository audits,
                                PasswordEncoder encoder) {
        this.users = users;
        this.roles = roles;
        this.refreshTokens = refreshTokens;
        this.audits = audits;
        this.encoder = encoder;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AdminUserResponse> list(Pageable pageable) {
        if (pageable.getPageSize() > 100) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Maximum page size is 100");
        }
        return users.findAll(pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public AdminUserResponse get(UUID id) {
        return toResponse(find(id));
    }

    @Override
    @Transactional
    public AdminUserResponse create(UUID actorId, CreateAdminUserRequest request) {
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Email already exists");
        }
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail(email);
        user.setPasswordHash(encoder.encode(request.password()));
        user.setFullName(request.fullName().trim());
        user.setPhone(request.phone());
        user.setStatus(UserStatus.ACTIVE);
        user.setRoles(resolveRoles(request.roles()));
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(user.getCreatedAt());
        users.save(user);
        audit(actorId, user.getId(), "CREATE_USER", null, roleNames(user));
        return toResponse(user);
    }

    @Override
    @Transactional
    public AdminUserResponse update(UUID actorId, UUID id, UpdateAdminUserRequest request) {
        User user = locked(id);
        String before = profileSnapshot(user);
        String email = normalizeEmail(request.email());
        if (!user.getEmail().equals(email) && users.existsByEmail(email)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Email already exists");
        }
        user.setEmail(email);
        user.setFullName(request.fullName().trim());
        user.setPhone(request.phone());
        user.setUpdatedAt(LocalDateTime.now());
        if (!before.equals(profileSnapshot(user))) {
            // Refresh tokens carry the prior identity details and should not be reusable.
            refreshTokens.revokeAllByUserId(id);
            audit(actorId, id, "UPDATE_USER", before, profileSnapshot(user));
        }
        return toResponse(user);
    }

    @Override
    @Transactional
    public AdminUserResponse setStatus(UUID actorId, UUID id, UpdateUserStatusRequest request) {
        User user = locked(id);
        if (actorId.equals(id) && request.status() != UserStatus.ACTIVE) {
            throw new BusinessException(ErrorCode.CONFLICT, "Administrators cannot deactivate their own account");
        }
        if (user.getStatus() == UserStatus.ACTIVE && request.status() != UserStatus.ACTIVE) {
            guardLastActiveAdmin(user);
        }
        UserStatus previous = user.getStatus();
        if (previous != request.status()) {
            user.setStatus(request.status());
            user.setUpdatedAt(LocalDateTime.now());
            refreshTokens.revokeAllByUserId(id);
            audit(actorId, id, "SET_STATUS", previous.name(), request.status().name());
            log.info("Admin {} changed account {} status", actorId, id);
        }
        return toResponse(user);
    }

    @Override
    @Transactional
    public AdminUserResponse setRoles(UUID actorId, UUID id, UpdateUserRolesRequest request) {
        User user = locked(id);
        Set<Role> replacement = resolveRoles(request.roles());
        validateRemoval(actorId, user, request.roles());
        String previous = roleNames(user);
        String next = roleNames(replacement);
        if (!previous.equals(next)) {
            user.setRoles(replacement);
            user.setUpdatedAt(LocalDateTime.now());
            refreshTokens.revokeAllByUserId(id);
            audit(actorId, id, "SET_ROLES", previous, next);
            log.info("Admin {} changed account {} roles", actorId, id);
        }
        return toResponse(user);
    }

    @Override
    @Transactional
    public AdminUserResponse grantRole(UUID actorId, UUID id, RoleCode role) {
        User user = locked(id);
        Set<RoleCode> codes = user.getRoles().stream().map(Role::getCode)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(RoleCode.class)));
        codes.add(role);
        return replaceRoles(actorId, user, codes);
    }

    @Override
    @Transactional
    public AdminUserResponse revokeRole(UUID actorId, UUID id, RoleCode role) {
        User user = locked(id);
        Set<RoleCode> codes = user.getRoles().stream().map(Role::getCode)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(RoleCode.class)));
        if (!codes.remove(role)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Role not assigned");
        }
        return replaceRoles(actorId, user, codes);
    }

    private AdminUserResponse replaceRoles(UUID actorId, User user, Set<RoleCode> codes) {
        if (codes.isEmpty()) {
            throw new BusinessException(ErrorCode.CONFLICT, "At least one role is required");
        }
        validateRemoval(actorId, user, codes);
        String previous = roleNames(user);
        Set<Role> replacement = resolveRoles(codes);
        String next = roleNames(replacement);
        if (!previous.equals(next)) {
            user.setRoles(replacement);
            user.setUpdatedAt(LocalDateTime.now());
            refreshTokens.revokeAllByUserId(user.getId());
            audit(actorId, user.getId(), "SET_ROLES", previous, next);
            log.info("Admin {} changed account {} roles", actorId, user.getId());
        }
        return toResponse(user);
    }

    private void validateRemoval(UUID actorId, User user, Set<RoleCode> replacement) {
        if (hasAdminRole(user) && !replacement.contains(RoleCode.ROLE_ADMIN)) {
            if (actorId.equals(user.getId())) {
                throw new BusinessException(ErrorCode.CONFLICT, "Administrators cannot remove their own admin role");
            }
            guardLastActiveAdmin(user);
        }
    }

    private void guardLastActiveAdmin(User user) {
        if (user.getStatus() != UserStatus.ACTIVE || !hasAdminRole(user)) {
            return;
        }
        // Serialize changes to distinct administrators before counting active admins.
        roles.findLockedByCode(RoleCode.ROLE_ADMIN).orElseThrow(() ->
                new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Admin role is not configured"));
        if (users.countActiveAdmins() <= 1) {
            throw new BusinessException(ErrorCode.CONFLICT, "Cannot remove the last active administrator");
        }
    }

    private boolean hasAdminRole(User user) {
        return user.getRoles().stream().anyMatch(role -> role.getCode() == RoleCode.ROLE_ADMIN);
    }

    private User find(UUID id) {
        return users.findById(id).orElseThrow(() ->
                new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "User not found"));
    }

    private User locked(UUID id) {
        return users.findLockedById(id).orElseThrow(() ->
                new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "User not found"));
    }

    private Set<Role> resolveRoles(Set<RoleCode> codes) {
        Set<Role> result = new HashSet<>();
        for (RoleCode code : codes) {
            result.add(roles.findByCode(code).orElseThrow(() ->
                    new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Role not configured: " + code)));
        }
        return result;
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String profileSnapshot(User user) {
        // Never include password hashes or tokens in audit records.
        return "email=" + user.getEmail() + ";name=" + user.getFullName()
                + ";phone=" + Objects.toString(user.getPhone(), "");
    }

    private String roleNames(User user) {
        return roleNames(user.getRoles());
    }

    private String roleNames(Set<Role> roles) {
        return roles.stream().map(role -> role.getCode().name()).sorted().collect(Collectors.joining(","));
    }

    private AdminUserResponse toResponse(User user) {
        return new AdminUserResponse(user.getId(), user.getEmail(), user.getFullName(), user.getPhone(),
                user.getStatus(), user.getRoles().stream().map(role -> role.getCode().name()).collect(Collectors.toSet()),
                user.getCreatedAt(), user.getUpdatedAt());
    }

    private void audit(UUID actorId, UUID targetId, String action, String before, String after) {
        AdminAudit entry = new AdminAudit();
        entry.setId(UUID.randomUUID());
        entry.setActorUserId(actorId);
        entry.setTargetUserId(targetId);
        entry.setAction(action);
        entry.setOldValue(before);
        entry.setNewValue(after);
        entry.setCreatedAt(LocalDateTime.now());
        audits.save(entry);
    }
}