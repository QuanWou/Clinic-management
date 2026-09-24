package com.clinic.identity.repository;

import com.clinic.identity.entity.Role;
import com.clinic.identity.entity.RoleCode;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface RoleRepository extends JpaRepository<Role, UUID> {
    Optional<Role> findByCode(RoleCode code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Role r where r.code = :code")
    Optional<Role> findLockedByCode(RoleCode code);
}