package com.clinic.catalog.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "medicines")
@Getter
@Setter
public class Medicine {
    @Id
    private UUID id;
    @Column(nullable = false, unique = true, length = 60)
    private String code;
    @Column(nullable = false)
    private String name;
    @Column(nullable = false, length = 50)
    private String unit;
    @Column(length = 1000)
    private String description;
    @Column(nullable = false)
    private boolean active = true;
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}