package com.clinic.identity.repository;

import com.clinic.identity.entity.User;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findLockedById(UUID id);

    @Query("select count(distinct u.id) from User u join u.roles r where r.code = com.clinic.identity.entity.RoleCode.ROLE_ADMIN and u.status = com.clinic.identity.entity.UserStatus.ACTIVE")
    long countActiveAdmins();
}