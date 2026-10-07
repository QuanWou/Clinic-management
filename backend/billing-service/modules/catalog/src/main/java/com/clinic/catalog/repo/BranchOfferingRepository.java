package com.clinic.catalog.repo;
import com.clinic.catalog.domain.BranchOffering;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface BranchOfferingRepository extends JpaRepository<BranchOffering,UUID>{
    Optional<BranchOffering> findByIdAndClinicIdAndBranchId(UUID id,UUID clinicId,UUID branchId);
    Optional<BranchOffering> findByClinicIdAndBranchIdAndOfferingId(UUID clinicId,UUID branchId,UUID offeringId);
    List<BranchOffering> findByClinicIdAndBranchIdOrderByCreatedAtAsc(UUID clinicId,UUID branchId);
}
