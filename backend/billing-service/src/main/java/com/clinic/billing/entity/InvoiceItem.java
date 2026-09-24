package com.clinic.billing.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "invoice_items")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class InvoiceItem {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "invoice_id", nullable = false)
    private UUID invoiceId;
    @Column(name = "source_type", nullable = false, length = 20)
    private String sourceType;
    @Column(name = "source_id", nullable = false)
    private UUID sourceId;
    @Column(name = "service_id", nullable = false)
    private UUID serviceId;
    @Column(name = "service_code", nullable = false, length = 60)
    private String serviceCode;
    @Column(name = "service_name", nullable = false, length = 255)
    private String serviceName;
    @Column(name = "price_id", nullable = false)
    private UUID priceId;
    @Column(name = "service_date", nullable = false)
    private LocalDate serviceDate;
    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;
    @Column(name = "quantity", nullable = false)
    private Integer quantity;
    @Column(name = "line_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal lineAmount;
    @Column(name = "currency", nullable = false, length = 3)
    private String currency;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}