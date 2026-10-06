package com.clinic.clinic.repo;
import com.clinic.clinic.domain.ReviewEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface ReviewRepository extends JpaRepository<ReviewEvent,UUID>{
    List<ReviewEvent> findByClinicIdOrderByOccurredAtAsc(UUID clinicId);
}
