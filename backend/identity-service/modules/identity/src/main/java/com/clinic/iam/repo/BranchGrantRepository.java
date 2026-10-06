package com.clinic.iam.repo;
import com.clinic.iam.domain.BranchGrant;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface BranchGrantRepository extends JpaRepository<BranchGrant,UUID>{
 List<BranchGrant> findByMembershipIdAndActiveTrueOrderByBranchId(UUID membershipId);
 Optional<BranchGrant> findByMembershipIdAndBranchId(UUID membershipId,UUID branchId);
}
