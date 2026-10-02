package com.clinic.v2.patient.repo;
import com.clinic.v2.patient.domain.ClinicPatientLink;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface ClinicPatientLinkRepository extends JpaRepository<ClinicPatientLink,UUID>{
 Optional<ClinicPatientLink> findByClinicIdAndPatientId(UUID clinicId,UUID patientId);
}
