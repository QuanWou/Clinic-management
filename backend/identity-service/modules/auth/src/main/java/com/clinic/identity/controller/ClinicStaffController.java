package com.clinic.identity.controller;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.identity.dto.*;
import com.clinic.identity.entity.*;
import com.clinic.identity.repository.UserRepository;
import com.clinic.identity.security.CurrentUserPrincipal;
import com.clinic.identity.service.AdminUserService;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import java.time.Duration;
import java.util.*;

/** Account data stays in Auth; clinic roles and their authorization stay in IAM. */
@RestController
@RequestMapping("/api/clinic-staff/{clinicId}")
public class ClinicStaffController {
    private final UserRepository users;
    private final AdminUserService accounts;
    private final RestClient iam;

    @Autowired
    public ClinicStaffController(UserRepository users, AdminUserService accounts,
            RestClient.Builder builder, @Value("${app.staff.iam-url:http://127.0.0.1:8093}") String url) {
        this(users, accounts, client(builder, url));
    }
    ClinicStaffController(UserRepository users, AdminUserService accounts, RestClient iam) {
        this.users = users; this.accounts = accounts; this.iam = iam;
    }
    private static RestClient client(RestClient.Builder builder, String url) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3)); factory.setReadTimeout(Duration.ofSeconds(10));
        return builder.baseUrl(url).requestFactory(factory).build();
    }

    @GetMapping
    public List<StaffRow> list(@PathVariable UUID clinicId, @RequestHeader(HttpHeaders.AUTHORIZATION) String bearer) {
        List<Member> members = members(clinicId, bearer);
        Map<UUID, User> directory = new HashMap<>();
        users.findAllById(members.stream().map(Member::userId).toList()).forEach(u -> directory.put(u.getId(), u));
        return members.stream().map(m -> row(m, directory.get(m.userId()))).toList();
    }

    @GetMapping("/lookup")
    public Lookup lookup(@PathVariable UUID clinicId, @RequestHeader(HttpHeaders.AUTHORIZATION) String bearer,
                         @RequestParam String email) {
        members(clinicId, bearer); // Authorize clinic-wide management before any account lookup.
        return users.findByEmail(normalize(email)).map(u -> new Lookup(account(u))).orElseGet(() -> new Lookup(null));
    }

    @PostMapping
    public StaffRow create(@PathVariable UUID clinicId, @RequestHeader(HttpHeaders.AUTHORIZATION) String bearer,
                           @AuthenticationPrincipal CurrentUserPrincipal actor, @Valid @RequestBody CreateStaff input) {
        members(clinicId, bearer);
        User user = users.findByEmail(normalize(input.email())).orElse(null);
        if (user != null && !input.useExistingAccount())
            throw problem(ErrorCode.CONFLICT, "Email đã được đăng ký. Kiểm tra tài khoản và chọn dùng tài khoản hiện có.");
        if (user == null) {
            if (input.useExistingAccount()) throw problem(ErrorCode.CONFLICT, "Tài khoản vừa thay đổi. Hãy kiểm tra lại email.");
            if (input.password() == null || input.password().length() < 8)
                throw problem(ErrorCode.VALIDATION_ERROR, "Mật khẩu ban đầu cần ít nhất 8 ký tự.");
            var created = accounts.create(actor.id(), new CreateAdminUserRequest(input.email(), input.password(),
                input.fullName(), input.phone(), Set.of(RoleCode.ROLE_PATIENT)));
            user = users.findById(created.id()).orElseThrow();
        }
        if (user.getStatus() != UserStatus.ACTIVE)
            throw problem(ErrorCode.CONFLICT, "Tài khoản này đang bị khóa, chưa thể thêm vào nhân sự.");
        try {
            Member member = iam.post().uri("/api/clinics/{id}/staff", clinicId)
                .header(HttpHeaders.AUTHORIZATION, bearer)
                .body(Map.of("userId", user.getId(), "role", input.role(), "allBranches", true))
                .retrieve().body(Member.class);
            return row(Objects.requireNonNull(member), user);
        } catch (RestClientResponseException e) { throw remoteProblem(e); }
        // If IAM is temporarily unavailable the new account remains valid. A reload
        // and explicit existing-account selection safely resumes provisioning.
    }

    @PutMapping("/{membershipId}")
    public StaffRow update(@PathVariable UUID clinicId, @PathVariable UUID membershipId,
                          @RequestHeader(HttpHeaders.AUTHORIZATION) String bearer,
                          @AuthenticationPrincipal CurrentUserPrincipal actor,
                          @Valid @RequestBody UpdateAdminUserRequest input) {
        Member member = manageableMember(clinicId, membershipId, bearer, actor);
        accounts.update(actor.id(), member.userId(), input);
        return row(member, users.findById(member.userId()).orElseThrow());
    }

    @PatchMapping("/{membershipId}/status")
    public StaffRow status(@PathVariable UUID clinicId, @PathVariable UUID membershipId,
                           @RequestHeader(HttpHeaders.AUTHORIZATION) String bearer,
                           @AuthenticationPrincipal CurrentUserPrincipal actor,
                           @Valid @RequestBody AccountStatus input) {
        Member member = manageableMember(clinicId, membershipId, bearer, actor);
        accounts.setStatus(actor.id(), member.userId(), new UpdateUserStatusRequest(input.status()));
        return row(member, users.findById(member.userId()).orElseThrow());
    }

    @PostMapping("/{membershipId}/reset-password")
    public StaffRow resetPassword(@PathVariable UUID clinicId, @PathVariable UUID membershipId,
                                  @RequestHeader(HttpHeaders.AUTHORIZATION) String bearer,
                                  @AuthenticationPrincipal CurrentUserPrincipal actor,
                                  @Valid @RequestBody ResetPassword input) {
        Member member = manageableMember(clinicId, membershipId, bearer, actor);
        accounts.resetPassword(actor.id(), member.userId(), input.password());
        return row(member, users.findById(member.userId()).orElseThrow());
    }

    private Member manageableMember(UUID clinicId, UUID membershipId, String bearer, CurrentUserPrincipal actor) {
        Member member = members(clinicId, bearer).stream().filter(m -> m.id().equals(membershipId)).findFirst()
            .orElseThrow(() -> problem(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy nhân sự trong phòng khám."));
        if (member.clinicOwner() || member.userId().equals(actor.id()))
            throw problem(ErrorCode.FORBIDDEN, "Tài khoản chủ phòng khám và tài khoản đang dùng được bảo vệ tại màn hình này.");
        if (!Set.of("STAFF", "DOCTOR").contains(member.role()))
            throw problem(ErrorCode.FORBIDDEN, "Màn hình này chỉ quản lý tài khoản bác sĩ và lễ tân.");
        return member;
    }

    private List<Member> members(UUID clinic, String bearer) {
        try {
            return Objects.requireNonNull(iam.get().uri("/api/clinics/{id}/memberships", clinic)
                .header(HttpHeaders.AUTHORIZATION, bearer).retrieve()
                .body(new ParameterizedTypeReference<List<Member>>() {}));
        } catch (RestClientResponseException e) { throw remoteProblem(e); }
    }
    private BusinessException remoteProblem(RestClientResponseException e) {
        String code = switch (e.getStatusCode().value()) {
            case 401 -> ErrorCode.UNAUTHORIZED; case 403 -> ErrorCode.FORBIDDEN;
            case 404 -> ErrorCode.RESOURCE_NOT_FOUND; case 409 -> ErrorCode.CONFLICT;
            default -> ErrorCode.INTERNAL_SERVER_ERROR;
        };
        return problem(code, "Chưa hoàn tất quản lý nhân sự. Tải lại bảng để đối chiếu quyền và dữ liệu trước khi thử tiếp.");
    }
    private static BusinessException problem(String code, String message) { return new BusinessException(code, message); }
    private static String normalize(String email) { return email.trim().toLowerCase(Locale.ROOT); }
    private static Account account(User u) { return new Account(u.getId(), u.getFullName(), u.getEmail(), u.getPhone(), u.getAccountCode(), u.getStatus()); }
    private static StaffRow row(Member m, User u) { return new StaffRow(m, u == null ? null : account(u)); }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Member(UUID id, UUID userId, String role, String status, boolean allBranches,
                         long version, List<UUID> branchIds, boolean clinicOwner) {}
    public record Account(UUID userId, String fullName, String email, String phone, String accountCode, UserStatus status) {}
    public record StaffRow(Member membership, Account account) {}
    public record Lookup(Account account) {}
    public record CreateStaff(@NotBlank @Email String email, @NotBlank @Size(max=255) String fullName,
                              @Size(max=50) String phone, @Size(max=100) String password,
                              @NotBlank @Pattern(regexp="STAFF|DOCTOR") String role,
                              boolean useExistingAccount) {}
    public record AccountStatus(@NotNull UserStatus status) {}
    public record ResetPassword(@NotBlank @Size(min=8,max=100) String password) {}
}
