package com.clinic.identity.controller;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.identity.dto.UpdateAdminUserRequest;
import com.clinic.identity.entity.*;
import com.clinic.identity.repository.UserRepository;
import com.clinic.identity.security.CurrentUserPrincipal;
import com.clinic.identity.service.AdminUserService;
import org.junit.jupiter.api.*;
import org.springframework.http.*;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class ClinicStaffControllerTest {
    UserRepository users; AdminUserService accounts; MockRestServiceServer server; ClinicStaffController controller;
    UUID clinic=UUID.randomUUID(), membership=UUID.randomUUID(), target=UUID.randomUUID();
    CurrentUserPrincipal actor=new CurrentUserPrincipal(UUID.randomUUID(),"manager@example.invalid","Manager",Set.of("ROLE_PATIENT"));
    String bearer="Bearer synthetic-session";
    @BeforeEach void setup(){
        users=mock(UserRepository.class);accounts=mock(AdminUserService.class);
        var builder=RestClient.builder().baseUrl("http://iam");server=MockRestServiceServer.bindTo(builder).build();
        controller=new ClinicStaffController(users,accounts,builder.build());
    }
    @AfterEach void verifyRequests(){server.verify();}
    String member(boolean owner){return "{\"id\":\""+membership+"\",\"userId\":\""+target+"\",\"role\":\"STAFF\",\"status\":\"ACTIVE\",\"allBranches\":true,\"version\":1,\"branchIds\":[],\"clinicOwner\":"+owner+"}";}
    void authorize(String body){server.expect(requestTo("http://iam/api/clinics/"+clinic+"/memberships")).andExpect(header(HttpHeaders.AUTHORIZATION,bearer)).andRespond(withSuccess(body,MediaType.APPLICATION_JSON));}
    User user(){User u=new User();u.setId(target);u.setFullName("Existing employee");u.setEmail("existing@example.invalid");u.setStatus(UserStatus.ACTIVE);return u;}
    ClinicStaffController.CreateStaff input(boolean existing){return new ClinicStaffController.CreateStaff("existing@example.invalid","Submitted name","","Initial!123","DOCTOR",existing);}

    @Test void deniedClinicAccessCannotReadOrCreateAccounts(){
        server.expect(requestTo("http://iam/api/clinics/"+clinic+"/memberships")).andRespond(withStatus(HttpStatus.FORBIDDEN));
        var error=assertThrows(BusinessException.class,()->controller.create(clinic,bearer,actor,input(false)));
        assertEquals(ErrorCode.FORBIDDEN,error.getErrorCode());verifyNoInteractions(users,accounts);
    }
    @Test void directoryOnlyLoadsMembersOfAuthorizedClinic(){
        authorize("["+member(false)+"]");when(users.findAllById(List.of(target))).thenReturn(List.of(user()));
        var rows=controller.list(clinic,bearer);assertEquals(1,rows.size());assertEquals(target,rows.getFirst().account().userId());
        verify(users).findAllById(List.of(target));verifyNoInteractions(accounts);
    }
    @Test void anExistingAccountNeedsExplicitSelection(){
        authorize("[]");when(users.findByEmail("existing@example.invalid")).thenReturn(Optional.of(user()));
        assertEquals(ErrorCode.CONFLICT,assertThrows(BusinessException.class,()->controller.create(clinic,bearer,actor,input(false))).getErrorCode());
        verifyNoInteractions(accounts);
    }
    @Test void selectingExistingAccountNeverReplacesItsPasswordOrProfile(){
        authorize("[]");when(users.findByEmail("existing@example.invalid")).thenReturn(Optional.of(user()));
        server.expect(requestTo("http://iam/api/clinics/"+clinic+"/staff")).andExpect(method(HttpMethod.POST))
            .andExpect(jsonPath("$.userId").value(target.toString())).andExpect(jsonPath("$.role").value("DOCTOR"))
            .andRespond(withSuccess(member(false),MediaType.APPLICATION_JSON));
        var result=controller.create(clinic,bearer,actor,input(true));
        assertEquals("Existing employee",result.account().fullName());verifyNoInteractions(accounts);
    }
    @Test void cannotEditAUserOutsideClinicMembership(){
        authorize("[]");assertEquals(ErrorCode.RESOURCE_NOT_FOUND,assertThrows(BusinessException.class,()->controller.update(clinic,membership,bearer,actor,new UpdateAdminUserRequest("x@example.invalid","New name",null))).getErrorCode());
        verifyNoInteractions(users,accounts);
    }
    @Test void ownerProfileCannotBeOverwrittenFromStaffTable(){
        authorize("["+member(true)+"]");assertEquals(ErrorCode.FORBIDDEN,assertThrows(BusinessException.class,()->controller.update(clinic,membership,bearer,actor,new UpdateAdminUserRequest("x@example.invalid","New name",null))).getErrorCode());
        verifyNoInteractions(users,accounts);
    }
    @Test void clinicManagerCanLockAndResetPasswordForReceptionAccount(){
        User account=user();when(users.findById(target)).thenReturn(Optional.of(account));
        authorize("["+member(false)+"]");authorize("["+member(false)+"]");
        var locked=controller.status(clinic,membership,bearer,actor,new ClinicStaffController.AccountStatus(UserStatus.LOCKED));
        assertEquals(UserStatus.ACTIVE,locked.account().status());
        verify(accounts).setStatus(eq(actor.id()),eq(target),argThat(r->r.status()==UserStatus.LOCKED));
        controller.resetPassword(clinic,membership,bearer,actor,new ClinicStaffController.ResetPassword("Temporary!123"));
        verify(accounts).resetPassword(actor.id(),target,"Temporary!123");
    }
}
