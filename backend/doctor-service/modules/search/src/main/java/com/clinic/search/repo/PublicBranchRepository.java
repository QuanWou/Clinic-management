package com.clinic.search.repo;
import com.clinic.search.domain.PublicBranch;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface PublicBranchRepository extends JpaRepository<PublicBranch,UUID>{
  List<PublicBranch> findByClinicIdAndActiveTrueOrderByNameAsc(UUID clinicId);
  void deleteByClinicId(UUID clinicId);
}
