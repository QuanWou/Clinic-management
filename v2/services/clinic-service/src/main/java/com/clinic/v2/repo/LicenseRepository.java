package com.clinic.v2.repo;
import com.clinic.v2.domain.ClinicLicense;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
public interface LicenseRepository extends JpaRepository<ClinicLicense,UUID>{}
