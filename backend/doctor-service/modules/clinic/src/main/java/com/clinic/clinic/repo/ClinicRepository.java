package com.clinic.clinic.repo;
import com.clinic.clinic.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import java.util.*;
public interface ClinicRepository extends JpaRepository<Clinic,UUID> {
    Optional<Clinic> findBySlug(String slug);
    List<Clinic> findByOwnerUserIdOrderByCreatedAtDesc(UUID owner);
    Page<Clinic> findByReviewStatusOrderByCreatedAtAsc(ReviewStatus status, Pageable pageable);
    @Query("select c from Clinic c, ClinicLicense l where l.clinicId = c.id and c.publicationStatus = com.clinic.clinic.domain.PublicationStatus.PUBLISHED and c.reviewStatus = com.clinic.clinic.domain.ReviewStatus.APPROVED and c.evidenceVerified = true and c.publishedAt is not null and l.validUntil >= :today and exists (select b.id from Branch b where b.clinicId = c.id and b.active = true) order by c.publishedAt desc")
    Page<Clinic> findPublicEligible(@Param("today") java.time.LocalDate today, Pageable pageable);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Clinic c where c.id = :id")
    Optional<Clinic> lockById(@Param("id") UUID id);
}
