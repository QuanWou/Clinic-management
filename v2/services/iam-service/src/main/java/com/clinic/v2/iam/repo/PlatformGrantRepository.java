package com.clinic.v2.iam.repo;
import com.clinic.v2.iam.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface PlatformGrantRepository extends JpaRepository<PlatformGrant,PlatformGrantId> {
    boolean existsByUserIdAndCapabilityAndStatus(UUID userId,PlatformCapability capability,MembershipStatus status);
    List<PlatformGrant> findByUserIdAndStatus(UUID userId,MembershipStatus status);
}
