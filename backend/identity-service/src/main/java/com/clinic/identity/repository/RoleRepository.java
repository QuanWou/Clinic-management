package com.clinic.identity.repository;

import com.clinic.identity.entity.Role;
import com.clinic.identity.entity.RoleCode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RoleRepository extends JpaRepository<Role, UUID> {
    Optional<Role> findByCode(RoleCode code);
}