package com.clinic.catalog.repo;
import com.clinic.catalog.domain.Offering;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface OfferingRepository extends JpaRepository<Offering,UUID>{
    Optional<Offering> findByIdAndClinicId(UUID id,UUID clinicId);
    List<Offering> findByClinicIdOrderByCodeAsc(UUID clinicId);
}
