package com.clinic.identity.controller;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.identity.dto.*;
import com.clinic.identity.entity.*;
import com.clinic.identity.repository.UserRepository;
import com.clinic.identity.security.CurrentUserPrincipal;
import com.clinic.identity.service.AdminUserService;
import org.junit.jupiter.api.*;
import org.springframework.data.domain.*;
import org.springframework.http.*;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class ClinicPatientAccountControllerTest {
    UserRepository users; AdminUserService accounts; MockRestServiceServer server;
    ClinicPatientAccountController controller;
    UUID clinic=UUID.randomUUID(),target=UUID.randomUUID();
    CurrentUserPrincipal actor=new CurrentUserPrincipal(UUID.randomUUID(),"admin@example.invalid","Admin",Set.of("ROLE_PATIENT"));
    String bearer="Bearer test-session";
    @BeforeEach void setup(){
        users=mock(UserRepository.class);accounts=mock(AdminUserService.class);
        var builder=RestClient.builder().baseUrl("http://iam");server=MockRestServiceServer.bindTo(builder).build();
        controller=new ClinicPatientAccountController(users,accounts,builder.build());
    }
    @AfterEach void verifyRequests(){server.verify();}
    void authorize(String body){server.expect(requestTo("http://iam/api/clinics/"+clinic+"/memberships"))
        .andExpect(header(HttpHeaders.AUTHORIZATION,bearer)).andRespond(withSuccess(body,MediaType.APPLICATION_JSON));}
    User patient(){var user=new User();user.setId(target);var role=new Role();role.setCode(RoleCode.ROLE_PATIENT);user.setRoles(Set.of(role));return user;}
    @Test void deniedClinicAdminCannotReadAccounts(){
        server.expect(requestTo("http://iam/api/clinics/"+clinic+"/memberships")).andRespond(withStatus(HttpStatus.FORBIDDEN));
        assertEquals(ErrorCode.FORBIDDEN,assertThrows(BusinessException.class,()->controller.list(clinic,bearer,actor,"",null,0,20)).getErrorCode());
        verifyNoInteractions(users,accounts);
    }
    @Test void revokedAccessCannotMutateAPatient(){
        server.expect(requestTo("http://iam/api/clinics/"+clinic+"/memberships")).andRespond(withStatus(HttpStatus.FORBIDDEN));
        assertThrows(BusinessException.class,()->controller.resetPassword(clinic,target,bearer,actor,new ClinicStaffController.ResetPassword("Temporary!123")));
        verifyNoInteractions(users,accounts);
    }
    @Test void listingExcludesStaffAndUsesLiteralSearchStatusAndPagination(){
        authorize("[{\"userId\":\""+target+"\",\"role\":\"STAFF\"}]");
        when(users.findPatientAccounts(anyList(),eq(UserStatus.LOCKED),eq("%an\\_%"),any())).thenReturn(Page.empty());
        controller.list(clinic,bearer,actor," An_ ",UserStatus.LOCKED,2,20);
        verify(users).findPatientAccounts(argThat(ids->ids.contains(target)&&ids.contains(actor.id())),eq(UserStatus.LOCKED),eq("%an\\_%"),argThat(p->p.getPageNumber()==2&&p.getPageSize()==20));
    }
    @Test void creatingAlwaysGrantsOnlyPatientRole(){
        authorize("[]");
        controller.create(clinic,bearer,actor,new ClinicPatientAccountController.CreatePatientAccount("patient@example.invalid","Temporary!123","Patient","0900000000"));
        verify(accounts).create(eq(actor.id()),argThat(in->in.roles().equals(Set.of(RoleCode.ROLE_PATIENT))));
    }
    @Test void iamStaffAccountCannotBeLockedFromPatientDirectory(){
        authorize("[{\"userId\":\""+target+"\",\"role\":\"DOCTOR\"}]");
        assertEquals(ErrorCode.FORBIDDEN,assertThrows(BusinessException.class,()->controller.status(clinic,target,bearer,actor,new UpdateUserStatusRequest(UserStatus.LOCKED))).getErrorCode());
        verifyNoInteractions(users,accounts);
    }
    @Test void legacyAdminOrDoctorCannotBeEditedByPatientEndpoint(){
        authorize("[]");var user=patient();var role=new Role();role.setCode(RoleCode.ROLE_DOCTOR);user.setRoles(Set.of(role));
        when(users.findLockedById(target)).thenReturn(Optional.of(user));
        assertEquals(ErrorCode.FORBIDDEN,assertThrows(BusinessException.class,()->controller.update(clinic,target,bearer,actor,new UpdateAdminUserRequest("p@example.invalid","Changed",null))).getErrorCode());
        verifyNoInteractions(accounts);
    }
    @Test void adminCanUpdateLockAndResetAnActualPatient(){
        authorize("[]");authorize("[]");authorize("[]");when(users.findLockedById(target)).thenReturn(Optional.of(patient()));
        var input=new UpdateAdminUserRequest("p@example.invalid","Patient","0900000000");
        controller.update(clinic,target,bearer,actor,input);verify(accounts).update(actor.id(),target,input);
        controller.status(clinic,target,bearer,actor,new UpdateUserStatusRequest(UserStatus.LOCKED));
        verify(accounts).setStatus(eq(actor.id()),eq(target),argThat(in->in.status()==UserStatus.LOCKED));
        controller.resetPassword(clinic,target,bearer,actor,new ClinicStaffController.ResetPassword("Temporary!123"));
        verify(accounts).resetPassword(actor.id(),target,"Temporary!123");
    }
    @Test void invalidPagingAndMissingActorFailBeforeAccountRead(){
        assertThrows(BusinessException.class,()->controller.list(clinic,bearer,null,"",null,0,20));
        authorize("[]");assertThrows(BusinessException.class,()->controller.list(clinic,bearer,actor,"",null,0,101));
        verifyNoInteractions(users,accounts);
    }
}
