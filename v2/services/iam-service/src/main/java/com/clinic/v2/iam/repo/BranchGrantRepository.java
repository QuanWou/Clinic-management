package com.clinic.v2.iam.repo;
import com.clinic.v2.iam.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface BranchGrantRepository extends JpaRepository<MembershipBranchGrant,BranchGrantId> {
    List<MembershipBranchGrant> findByMembershipId(UUID membershipId);
    void deleteByMembershipId(UUID membershipId);
    boolean existsByMembershipIdAndBranchId(UUID membershipId,UUID branchId);
}
