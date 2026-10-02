package com.clinic.v2.repo;
import com.clinic.v2.domain.Branch;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface BranchRepository extends JpaRepository<Branch,UUID>{
    List<Branch> findByClinicIdOrderByCreatedAtAsc(UUID clinicId);
    List<Branch> findByClinicIdAndActiveTrueOrderByCreatedAtAsc(UUID clinicId);
    Optional<Branch> findByIdAndClinicId(UUID id,UUID clinicId);
}
