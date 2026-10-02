package com.clinic.v2.iam.repo;

import com.clinic.v2.iam.domain.*;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;

public interface MembershipRepository extends JpaRepository<Membership,UUID> {
    List<Membership> findByUserIdAndStatusOrderByClinicIdAscRoleAsc(UUID userId, MembershipStatus status);
    List<Membership> findByClinicIdAndStatusOrderByUserIdAscRoleAsc(UUID clinicId, MembershipStatus status);
    Optional<Membership> findByUserIdAndClinicIdAndRole(UUID userId,UUID clinicId,MembershipRole role);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Membership m where m.id=:id")
    Optional<Membership> lockById(@Param("id") UUID id);
    @Query("select m from Membership m where m.userId=:userId and m.clinicId=:clinicId and m.status=com.clinic.v2.iam.domain.MembershipStatus.ACTIVE")
    List<Membership> activeForContext(@Param("userId") UUID userId,@Param("clinicId") UUID clinicId);
}
