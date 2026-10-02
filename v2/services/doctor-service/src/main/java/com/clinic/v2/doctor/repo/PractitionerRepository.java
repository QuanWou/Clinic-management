package com.clinic.v2.doctor.repo;
import com.clinic.v2.doctor.domain.Practitioner;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface PractitionerRepository extends JpaRepository<Practitioner,UUID>{
    Optional<Practitioner> findByPlatformUserId(UUID platformUserId);
}
