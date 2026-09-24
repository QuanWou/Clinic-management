package com.clinic.identity.repository;

import com.clinic.identity.entity.RefreshToken;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
    Optional<RefreshToken> findByToken(String token);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from RefreshToken t where t.token = :token")
    Optional<RefreshToken> findByTokenForUpdate(String token);

    @Modifying
    @Query("update RefreshToken token set token.revoked = true where token.user.id = :userId and token.revoked = false")
    int revokeAllByUserId(UUID userId);
}