package com.clinic.patient.repository;

import com.clinic.patient.entity.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PatientRepository extends JpaRepository<Patient, UUID> {
    Optional<Patient> findByUserId(UUID userId);

    Optional<Patient> findByPatientCode(String patientCode);

    @Query("select p from Patient p where (:phone is null or p.phone = :phone) "
            + "and (:name is null or lower(p.fullName) like :name escape '!') order by p.createdAt desc")
    List<Patient> searchForReception(@Param("phone") String phone, @Param("name") String name, Pageable pageable);
}
