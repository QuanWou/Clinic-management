package com.clinic.identity.repository;

import com.clinic.identity.entity.User;
import com.clinic.identity.dto.DoctorNameResponse;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import com.clinic.identity.entity.UserStatus;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);

    /** Patient-only accounts; IAM staff IDs are excluded even when their legacy role is PATIENT. */
    @Query("""
        select u from User u
        where exists (select r from u.roles r where r.code = com.clinic.identity.entity.RoleCode.ROLE_PATIENT)
          and not exists (select r from u.roles r where r.code <> com.clinic.identity.entity.RoleCode.ROLE_PATIENT)
          and u.id not in :excluded
          and (:status is null or u.status = :status)
          and (lower(u.fullName) like :query escape '\\' or lower(u.email) like :query escape '\\'
               or lower(coalesce(u.phone,'')) like :query escape '\\' or lower(coalesce(u.accountCode,'')) like :query escape '\\')
        """)
    Page<User> findPatientAccounts(List<UUID> excluded, UserStatus status, String query, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findLockedById(UUID id);

    @Query("select count(distinct u.id) from User u join u.roles r where r.code = com.clinic.identity.entity.RoleCode.ROLE_ADMIN and u.status = com.clinic.identity.entity.UserStatus.ACTIVE")
    long countActiveAdmins();

    /** Only accounts with the doctor role and active status may appear by name in booking. */
    @Query("select distinct new com.clinic.identity.dto.DoctorNameResponse(u.id, u.fullName) from User u join u.roles r where r.code = com.clinic.identity.entity.RoleCode.ROLE_DOCTOR and u.status = com.clinic.identity.entity.UserStatus.ACTIVE order by u.fullName asc, u.id asc")
    List<DoctorNameResponse> findActiveDoctorAccounts();
}
