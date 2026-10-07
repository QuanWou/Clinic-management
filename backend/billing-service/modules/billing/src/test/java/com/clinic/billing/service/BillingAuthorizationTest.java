package com.clinic.billing.service;

import com.clinic.billing.api.ApiProblem;
import com.clinic.billing.api.BillingDto.*;
import com.clinic.billing.security.Actor;
import com.clinic.billing.security.BillingDb;
import com.clinic.billing.security.IamAuthorizationClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;

import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class BillingAuthorizationTest {
    private final UUID clinic=UUID.randomUUID(),branch=UUID.randomUUID();
    private final Actor admin=new Actor(UUID.randomUUID(),Set.of(),"Bearer admin");
    private final Actor staff=new Actor(UUID.randomUUID(),Set.of(),"Bearer staff");
    private IamAuthorizationClient iam;
    private JdbcTemplate jdbc;
    private BillingService service;

    @BeforeEach
    void setup(){
        jdbc=mock(JdbcTemplate.class);
        BillingDb db=mock(BillingDb.class);
        iam=mock(IamAuthorizationClient.class);
        BillingSources sources=mock(BillingSources.class);
        ChargeSnapshots snapshots=mock(ChargeSnapshots.class);
        PlatformTransactionManager manager=mock(PlatformTransactionManager.class);
        TransactionStatus status=mock(TransactionStatus.class);
        when(manager.getTransaction(any())).thenReturn(status);
        service=new BillingService(jdbc,db,iam,sources,new ObjectMapper().findAndRegisterModules(),manager,snapshots);

        when(iam.decide(admin.id(),"BILLING",clinic,branch))
            .thenReturn(new IamAuthorizationClient.Decision(false,null,"ADMIN",1,"Admin does not collect"));
        when(iam.decide(admin.id(),"FINANCE_VIEW",clinic,branch))
            .thenReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"ADMIN",1,"Finance view"));
        when(iam.decide(admin.id(),"FINANCE_MANAGE",clinic,branch))
            .thenReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"ADMIN",1,"Finance manage"));

        when(iam.decide(staff.id(),"BILLING",clinic,branch))
            .thenReturn(new IamAuthorizationClient.Decision(true,UUID.randomUUID(),"STAFF",1,"Cashier"));
        when(iam.decide(staff.id(),"FINANCE_VIEW",clinic,branch))
            .thenReturn(new IamAuthorizationClient.Decision(false,null,"STAFF",1,"No finance supervision"));
        when(iam.decide(staff.id(),"FINANCE_MANAGE",clinic,branch))
            .thenReturn(new IamAuthorizationClient.Decision(false,null,"STAFF",1,"No finance approval"));

        when(jdbc.queryForList(anyString(),eq(UUID.class))).thenReturn(List.of());
    }

    @Test
    void adminCanReadFinanceWithoutReceivingCashierCapability(){
        assertTrue(service.list(admin,clinic,branch).isEmpty());
        assertThrows(ApiProblem.class,()->service.authorizeBilling(admin,clinic,branch));
        assertThrows(ApiProblem.class,()->service.open(admin,clinic,branch,"admin-open",new ShiftInput("Admin must not open cashier shift")));
        verify(iam).decide(admin.id(),"FINANCE_VIEW",clinic,branch);
        verify(iam,atLeastOnce()).decide(admin.id(),"BILLING",clinic,branch);
    }

    @Test
    void cashierCanOperateDeskButCannotApproveFinance(){
        assertDoesNotThrow(()->service.authorizeBilling(staff,clinic,branch));
        assertThrows(ApiProblem.class,()->service.adjust(staff,clinic,branch,UUID.randomUUID(),"staff-adjust",new AdjustmentInput(0,1000,"Cashier cannot approve adjustment")));
        assertThrows(ApiProblem.class,()->service.approve(staff,clinic,branch,UUID.randomUUID(),"staff-approve",new ApproveInput(0,"Cashier cannot approve own shift")));
        verify(iam,atLeast(2)).decide(staff.id(),"FINANCE_MANAGE",clinic,branch);
    }
}
