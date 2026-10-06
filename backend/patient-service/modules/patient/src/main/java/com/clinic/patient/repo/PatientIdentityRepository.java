package com.clinic.patient.repo;
import com.clinic.patient.domain.PatientIdentity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
public interface PatientIdentityRepository extends JpaRepository<PatientIdentity,UUID>{}
