package com.clinic.v2.catalog.repo;
import com.clinic.v2.catalog.domain.PriceVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.*;
public interface PriceVersionRepository extends JpaRepository<PriceVersion,UUID>{
    Optional<PriceVersion> findByIdAndClinicIdAndBranchId(UUID id,UUID clinicId,UUID branchId);
    List<PriceVersion> findByClinicIdAndBranchIdAndOfferingIdOrderByEffectiveFromAsc(UUID clinicId,UUID branchId,UUID offeringId);
    Optional<PriceVersion> findTopByClinicIdAndBranchIdAndOfferingIdAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(
        UUID clinicId,UUID branchId,UUID offeringId,Instant effectiveAt);
}
