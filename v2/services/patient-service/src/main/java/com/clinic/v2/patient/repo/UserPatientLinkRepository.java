package com.clinic.v2.patient.repo;
import com.clinic.v2.patient.domain.UserPatientLink;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface UserPatientLinkRepository extends JpaRepository<UserPatientLink,UUID>{
 Optional<UserPatientLink> findByPatientId(UUID patientId);
}
