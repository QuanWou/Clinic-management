package com.clinic.v2.iam.repo;
import com.clinic.v2.iam.domain.*;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface MembershipRepository extends JpaRepository<Membership,UUID>{
 List<Membership> findByUserIdAndStatusOrderByClinicId(UUID userId,MembershipStatus status);
 List<Membership> findByClinicIdAndStatusOrderByInvitedAt(UUID clinicId,MembershipStatus status);
 List<Membership> findByUserIdAndClinicIdAndStatusOrderByInvitedAt(UUID userId,UUID clinicId,MembershipStatus status);
 Optional<Membership> findByIdAndClinicId(UUID id,UUID clinicId);
 @Lock(LockModeType.PESSIMISTIC_WRITE)
 @Query("select m from Membership m where m.id=:id")
 Optional<Membership> lockById(@Param("id") UUID id);
}
