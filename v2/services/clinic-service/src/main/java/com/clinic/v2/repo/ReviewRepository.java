package com.clinic.v2.repo;
import com.clinic.v2.domain.ReviewEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface ReviewRepository extends JpaRepository<ReviewEvent,UUID>{
    List<ReviewEvent> findByClinicIdOrderByOccurredAtAsc(UUID clinicId);
}
