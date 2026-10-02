package com.clinic.v2.iam.security;

import com.clinic.v2.iam.domain.UserSecurityState;
import com.clinic.v2.iam.repo.UserSecurityStateRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SessionSecurityServiceTest {
    @Mock DatabaseScope scope;
    @Mock UserSecurityStateRepository states;
    SessionSecurityService service;
    UUID user=UUID.randomUUID();

    @BeforeEach void setup(){service=new SessionSecurityService(scope,states);}

    @Test void noRevocationStateAllowsCurrentToken(){
        Actor actor=new Actor(user,Set.of("ROLE_PATIENT"),Instant.now().minusSeconds(5));
        when(states.findById(user)).thenReturn(Optional.empty());
        assertTrue(service.accessAllowed(actor));
        verify(scope).user(user);
    }

    @Test void tokenAtOrBeforeInvalidBeforeIsDeniedButNewerTokenPasses(){
        Instant cut=Instant.now();
        UserSecurityState state=new UserSecurityState();state.userId=user;state.invalidBefore=cut;
        when(states.findById(user)).thenReturn(Optional.of(state));

        assertFalse(service.accessAllowed(new Actor(user,Set.of("ROLE_ADMIN"),cut.minusSeconds(1))));
        assertFalse(service.accessAllowed(new Actor(user,Set.of("ROLE_ADMIN"),cut)));
        assertTrue(service.accessAllowed(new Actor(user,Set.of("ROLE_ADMIN"),cut.plusSeconds(1))));
    }

    @Test void revokeBeforePersistsMonotonicCutoff(){
        Instant old=Instant.now().minusSeconds(30);
        UserSecurityState state=new UserSecurityState();state.userId=user;state.invalidBefore=old;
        when(states.findById(user)).thenReturn(Optional.of(state));
        when(states.saveAndFlush(state)).thenReturn(state);

        Instant cut=Instant.now();
        service.revokeBefore(user,cut);
        assertEquals(cut,state.invalidBefore);
        verify(states).saveAndFlush(state);

        reset(states);
        when(states.findById(user)).thenReturn(Optional.of(state));
        when(states.saveAndFlush(state)).thenReturn(state);
        service.revokeBefore(user,old);
        assertEquals(cut,state.invalidBefore);
    }
}
