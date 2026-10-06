package com.clinic.search.repo;
import com.clinic.search.domain.ProjectionReceipt;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ProjectionReceiptRepository extends JpaRepository<ProjectionReceipt,ProjectionReceipt.Key>{}
