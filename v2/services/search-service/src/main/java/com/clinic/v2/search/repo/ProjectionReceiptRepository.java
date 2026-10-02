package com.clinic.v2.search.repo;
import com.clinic.v2.search.domain.ProjectionReceipt;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ProjectionReceiptRepository extends JpaRepository<ProjectionReceipt,ProjectionReceipt.Key>{}
