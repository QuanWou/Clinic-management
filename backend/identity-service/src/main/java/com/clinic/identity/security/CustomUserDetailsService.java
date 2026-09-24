package com.clinic.identity.security;

import com.clinic.identity.entity.User;
import com.clinic.identity.entity.UserStatus;
import com.clinic.identity.repository.UserRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

import java.util.stream.Collectors;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPasswordHash(),
                user.getStatus() == UserStatus.ACTIVE,
                true,
                true,
                user.getStatus() != UserStatus.LOCKED,
                user.getRoles()
                        .stream()
                        .map(role -> new SimpleGrantedAuthority(role.getCode().name()))
                        .collect(Collectors.toSet())
        );
    }
}