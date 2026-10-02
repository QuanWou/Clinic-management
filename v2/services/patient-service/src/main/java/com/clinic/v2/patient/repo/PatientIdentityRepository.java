package com.clinic.v2.patient.repo;
import com.clinic.v2.patient.domain.PatientIdentity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
public interface PatientIdentityRepository extends JpaRepository<PatientIdentity,UUID>{}
