package com.clinic.clinic.repo;
import com.clinic.clinic.domain.ClinicLicense;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
public interface LicenseRepository extends JpaRepository<ClinicLicense,UUID>{}
