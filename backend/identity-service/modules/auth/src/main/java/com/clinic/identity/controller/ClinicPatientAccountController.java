package com.clinic.identity.controller;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.identity.dto.*;
import com.clinic.identity.entity.*;
import com.clinic.identity.repository.UserRepository;
import com.clinic.identity.security.CurrentUserPrincipal;
import com.clinic.identity.service.AdminUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.domain.*;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.*;
import java.time.Duration;
import java.util.*;

/** The single-clinic account directory uses current IAM administration rights, not legacy roles. */
@RestController
@RequestMapping("/api/clinic-patient-accounts/{clinicId}")
public class ClinicPatientAccountController {
    private final UserRepository users;
    private final AdminUserService accounts;
    private final RestClient iam;

    @Autowired
    public ClinicPatientAccountController(UserRepository users, AdminUserService accounts,
            RestClient.Builder builder, @Value("${app.staff.iam-url:http://127.0.0.1:8093}") String url) {
        this(users, accounts, client(builder, url));
    }
    ClinicPatientAccountController(UserRepository users, AdminUserService accounts, RestClient iam) {
        this.users=users; this.accounts=accounts; this.iam=iam;
    }
    private static RestClient client(RestClient.Builder builder,String url) {
        var factory=new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3)); factory.setReadTimeout(Duration.ofSeconds(10));
        return builder.baseUrl(url).requestFactory(factory).build();
    }

    @GetMapping
    public Page<AdminUserResponse> list(@PathVariable UUID clinicId,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String bearer,
            @AuthenticationPrincipal CurrentUserPrincipal actor,
            @RequestParam(defaultValue="") String query, @RequestParam(required=false) UserStatus status,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) {
        var excluded=excluded(clinicId,bearer,actor);
        if(page<0 || size<1 || size>100 || query.length()>255)
            throw problem(ErrorCode.VALIDATION_ERROR,"Bộ lọc hoặc phân trang không hợp lệ.");
        String search="%"+query.trim().toLowerCase(Locale.ROOT).replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%";
        return users.findPatientAccounts(excluded,status,search,
            PageRequest.of(page,size,Sort.by(Sort.Order.desc("createdAt"),Sort.Order.desc("id")))).map(this::view);
    }

    @PostMapping
    public AdminUserResponse create(@PathVariable UUID clinicId,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String bearer,
            @AuthenticationPrincipal CurrentUserPrincipal actor, @Valid @RequestBody CreatePatientAccount input) {
        excluded(clinicId,bearer,actor);
        return accounts.create(actor.id(),new CreateAdminUserRequest(input.email(),input.password(),
            input.fullName(),input.phone(),Set.of(RoleCode.ROLE_PATIENT)));
    }

    @GetMapping("/{id}")
    @Transactional(readOnly=true)
    public AdminUserResponse get(@PathVariable UUID clinicId,@PathVariable UUID id,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String bearer,
            @AuthenticationPrincipal CurrentUserPrincipal actor) {
        return view(requirePatient(clinicId,id,bearer,actor,false));
    }

    @PutMapping("/{id}")
    @Transactional
    public AdminUserResponse update(@PathVariable UUID clinicId,@PathVariable UUID id,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String bearer,
            @AuthenticationPrincipal CurrentUserPrincipal actor,@Valid @RequestBody UpdateAdminUserRequest input) {
        requirePatient(clinicId,id,bearer,actor);
        return accounts.update(actor.id(),id,input);
    }

    @PatchMapping("/{id}/status")
    @Transactional
    public AdminUserResponse status(@PathVariable UUID clinicId,@PathVariable UUID id,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String bearer,
            @AuthenticationPrincipal CurrentUserPrincipal actor,@Valid @RequestBody UpdateUserStatusRequest input) {
        requirePatient(clinicId,id,bearer,actor);
        return accounts.setStatus(actor.id(),id,input);
    }

    @PostMapping("/{id}/reset-password")
    @Transactional
    public AdminUserResponse resetPassword(@PathVariable UUID clinicId,@PathVariable UUID id,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String bearer,
            @AuthenticationPrincipal CurrentUserPrincipal actor,@Valid @RequestBody ClinicStaffController.ResetPassword input) {
        requirePatient(clinicId,id,bearer,actor);
        return accounts.resetPassword(actor.id(),id,input.password());
    }

    private User requirePatient(UUID clinic,UUID id,String bearer,CurrentUserPrincipal actor) {
        return requirePatient(clinic,id,bearer,actor,true);
    }
    private User requirePatient(UUID clinic,UUID id,String bearer,CurrentUserPrincipal actor,boolean lock) {
        var excluded=excluded(clinic,bearer,actor);
        if(excluded.contains(id))throw problem(ErrorCode.FORBIDDEN,"Tài khoản nhân sự được quản lý trong mục Nhân sự.");
        User user=(lock?users.findLockedById(id):users.findById(id)).orElseThrow(()->problem(ErrorCode.RESOURCE_NOT_FOUND,"Không tìm thấy tài khoản bệnh nhân."));
        if(user.getRoles().size()!=1 || user.getRoles().stream().noneMatch(r->r.getCode()==RoleCode.ROLE_PATIENT))
            throw problem(ErrorCode.FORBIDDEN,"Màn hình này chỉ quản lý tài khoản bệnh nhân.");
        return user;
    }

    private List<UUID> excluded(UUID clinic,String bearer,CurrentUserPrincipal actor) {
        if(actor==null)throw problem(ErrorCode.UNAUTHORIZED,"Vui lòng đăng nhập lại.");
        try {
            var members=iam.get().uri("/api/clinics/{id}/memberships",clinic)
                .header(HttpHeaders.AUTHORIZATION,bearer).retrieve()
                .body(new ParameterizedTypeReference<List<ClinicStaffController.Member>>() {});
            if(members==null)throw problem(ErrorCode.INTERNAL_SERVER_ERROR,"Chưa xác minh được quyền quản trị.");
            var ids=new HashSet<UUID>(); ids.add(actor.id());
            members.forEach(m->ids.add(m.userId()));
            return new ArrayList<>(ids);
        } catch(RestClientResponseException e) {
            String code=switch(e.getStatusCode().value()) {
                case 401->ErrorCode.UNAUTHORIZED; case 403->ErrorCode.FORBIDDEN;
                default->ErrorCode.INTERNAL_SERVER_ERROR;
            };
            throw problem(code,"Chưa xác minh được quyền quản lý tài khoản bệnh nhân. Hãy tải lại dữ liệu.");
        } catch(RestClientException e) {
            throw problem(ErrorCode.INTERNAL_SERVER_ERROR,"Không thể kết nối dịch vụ phân quyền. Hãy thử lại.");
        }
    }
    private AdminUserResponse view(User u) {
        return new AdminUserResponse(u.getId(),u.getEmail(),u.getFullName(),u.getPhone(),u.getStatus(),
            Set.of(RoleCode.ROLE_PATIENT.name()),u.getCreatedAt(),u.getUpdatedAt(),u.getAccountCode());
    }
    private static BusinessException problem(String code,String message) {return new BusinessException(code,message);}
    public record CreatePatientAccount(@NotBlank @Email @Size(max=255) String email,
        @NotBlank @Size(min=8,max=100) String password,@NotBlank @Size(max=255) String fullName,
        @Size(max=50) String phone) {}
}
