package com.clinic.identity.service.impl;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.identity.dto.*;
import com.clinic.identity.entity.*;
import com.clinic.identity.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminUserServiceImplTest {
    @Mock UserRepository users;
    @Mock RoleRepository roles;
    @Mock RefreshTokenRepository tokens;
    @Mock AdminAuditRepository audits;
    @Mock PasswordEncoder encoder;
    AdminUserServiceImpl service;
    UUID actor = UUID.randomUUID();
    UUID target = UUID.randomUUID();

    @BeforeEach
    void setup() {
        service = new AdminUserServiceImpl(users, roles, tokens, audits, encoder);
    }

    @Test
    void statusChangeRevokesTokensAndWritesAudit() {
        User user = user(RoleCode.ROLE_PATIENT);
        when(users.findLockedById(target)).thenReturn(Optional.of(user));

        assertEquals(UserStatus.LOCKED,
                service.setStatus(actor, target, new UpdateUserStatusRequest(UserStatus.LOCKED)).status());
        verify(tokens).revokeAllByUserId(target);
        verify(audits).save(argThat(audit -> audit.getActorUserId().equals(actor)
                && audit.getAction().equals("SET_STATUS")
                && audit.getNewValue().equals("LOCKED")));
    }

    @Test
    void cannotDeactivateOwnAccount() {
        when(users.findLockedById(actor)).thenReturn(Optional.of(user(RoleCode.ROLE_ADMIN)));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.setStatus(actor, actor, new UpdateUserStatusRequest(UserStatus.INACTIVE)));
        assertEquals(ErrorCode.CONFLICT, ex.getErrorCode());
        verifyNoInteractions(tokens, audits);
    }

    @Test
    void cannotRemoveLastActiveAdmin() {
        when(users.findLockedById(target)).thenReturn(Optional.of(user(RoleCode.ROLE_ADMIN)));
        when(roles.findByCode(RoleCode.ROLE_PATIENT)).thenReturn(Optional.of(role(RoleCode.ROLE_PATIENT)));
        when(roles.findLockedByCode(RoleCode.ROLE_ADMIN)).thenReturn(Optional.of(role(RoleCode.ROLE_ADMIN)));
        when(users.countActiveAdmins()).thenReturn(1L);
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.setRoles(actor, target, new UpdateUserRolesRequest(Set.of(RoleCode.ROLE_PATIENT))));
        assertEquals(ErrorCode.CONFLICT, ex.getErrorCode());
        verify(roles).findLockedByCode(RoleCode.ROLE_ADMIN);
        verifyNoInteractions(tokens, audits);
    }

    @Test
    void roleGrantRevokesTokens() {
        when(users.findLockedById(target)).thenReturn(Optional.of(user(RoleCode.ROLE_PATIENT)));
        when(roles.findByCode(RoleCode.ROLE_PATIENT)).thenReturn(Optional.of(role(RoleCode.ROLE_PATIENT)));
        when(roles.findByCode(RoleCode.ROLE_DOCTOR)).thenReturn(Optional.of(role(RoleCode.ROLE_DOCTOR)));
        assertTrue(service.grantRole(actor, target, RoleCode.ROLE_DOCTOR).roles().contains("ROLE_DOCTOR"));
        verify(tokens).revokeAllByUserId(target);
        verify(audits).save(any(AdminAudit.class));
    }

    @Test
    void lockingLastActiveAdminIsRejectedAndAuditsRemainUntouched() {
        User administrator = user(RoleCode.ROLE_ADMIN);
        when(users.findLockedById(target)).thenReturn(Optional.of(administrator));
        when(roles.findLockedByCode(RoleCode.ROLE_ADMIN)).thenReturn(Optional.of(role(RoleCode.ROLE_ADMIN)));
        when(users.countActiveAdmins()).thenReturn(1L);
        var ex = assertThrows(BusinessException.class,
                () -> service.setStatus(actor, target, new UpdateUserStatusRequest(UserStatus.LOCKED)));
        assertEquals(ErrorCode.CONFLICT, ex.getErrorCode());
        assertEquals(UserStatus.ACTIVE, administrator.getStatus());
        verifyNoInteractions(tokens, audits);
    }

    @Test
    void deactivationWithAnotherAdminRevokesRefreshAndAudits() {
        User administrator = user(RoleCode.ROLE_ADMIN);
        when(users.findLockedById(target)).thenReturn(Optional.of(administrator));
        when(roles.findLockedByCode(RoleCode.ROLE_ADMIN)).thenReturn(Optional.of(role(RoleCode.ROLE_ADMIN)));
        when(users.countActiveAdmins()).thenReturn(2L);
        assertEquals(UserStatus.INACTIVE,
                service.setStatus(actor, target, new UpdateUserStatusRequest(UserStatus.INACTIVE)).status());
        verify(tokens).revokeAllByUserId(target);
        verify(audits).save(argThat(audit -> "ACTIVE".equals(audit.getOldValue())
                && "INACTIVE".equals(audit.getNewValue())));
    }

    @Test
    void administratorCannotRevokeOwnAdminRole() {
        User administrator = user(RoleCode.ROLE_ADMIN);
        administrator.setId(actor);
        administrator.getRoles().add(role(RoleCode.ROLE_PATIENT));
        when(users.findLockedById(actor)).thenReturn(Optional.of(administrator));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.revokeRole(actor, actor, RoleCode.ROLE_ADMIN));
        assertEquals(ErrorCode.CONFLICT, ex.getErrorCode());
        assertTrue(ex.getMessage().contains("own admin role"));
        verifyNoInteractions(tokens, audits);
    }

    @Test
    void changingAccountDetailsAuditsBeforeAfterAndRevokesRefresh() {
        User existing = user(RoleCode.ROLE_PATIENT);
        existing.setPhone("111");
        when(users.findLockedById(target)).thenReturn(Optional.of(existing));
        service.update(actor, target, new UpdateAdminUserRequest("new@example.com", "Updated", "222"));
        verify(tokens).revokeAllByUserId(target);
        verify(audits).save(argThat(entry -> "UPDATE_USER".equals(entry.getAction())
                && entry.getOldValue().contains("test@example.com")
                && entry.getNewValue().contains("new@example.com")
                && !entry.getNewValue().contains("password")));
    }

    @Test
    void unchangedStatusDoesNotRevokeOrAudit() {
        when(users.findLockedById(target)).thenReturn(Optional.of(user(RoleCode.ROLE_PATIENT)));
        service.setStatus(actor, target, new UpdateUserStatusRequest(UserStatus.ACTIVE));
        verifyNoInteractions(tokens, audits);
    }

    private User user(RoleCode code) {
        User user = new User();
        user.setId(target);
        user.setEmail("test@example.com");
        user.setFullName("Test");
        user.setStatus(UserStatus.ACTIVE);
        user.setRoles(new HashSet<>(Set.of(role(code))));
        return user;
    }

    private Role role(RoleCode code) {
        Role role = new Role();
        role.setId(UUID.randomUUID());
        role.setCode(code);
        return role;
    }
}