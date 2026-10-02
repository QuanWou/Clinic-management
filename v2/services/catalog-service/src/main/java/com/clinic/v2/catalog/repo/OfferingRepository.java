package com.clinic.v2.catalog.repo;
import com.clinic.v2.catalog.domain.Offering;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface OfferingRepository extends JpaRepository<Offering,UUID>{
    Optional<Offering> findByIdAndClinicId(UUID id,UUID clinicId);
    List<Offering> findByClinicIdOrderByCodeAsc(UUID clinicId);
}
