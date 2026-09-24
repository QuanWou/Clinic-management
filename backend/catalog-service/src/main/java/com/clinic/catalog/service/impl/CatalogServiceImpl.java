package com.clinic.catalog.service.impl;

import com.clinic.catalog.dto.*;
import com.clinic.catalog.entity.*;
import com.clinic.catalog.repository.*;
import com.clinic.catalog.service.CatalogService;
import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.Currency;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Slf4j
public class CatalogServiceImpl implements CatalogService {
    private final MedicalServiceRepository services;
    private final MedicineRepository medicines;
    private final ServicePriceRepository prices;
    private final AdminAuditRepository audits;

    public CatalogServiceImpl(MedicalServiceRepository services, MedicineRepository medicines,
                              ServicePriceRepository prices, AdminAuditRepository audits) {
        this.services = services;
        this.medicines = medicines;
        this.prices = prices;
        this.audits = audits;
    }

    @Override
    @Transactional(readOnly = true)
    public List<CatalogServiceResponse> services() {
        return services.findByActiveTrue().stream().map(this::toService).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CatalogServiceResponse> allServices() {
        return services.findAll().stream().map(this::toService).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public CatalogServiceResponse service(UUID id) {
        return toService(findService(id));
    }

    @Override
    @Transactional
    public CatalogServiceResponse createService(UUID actor, CatalogServiceRequest request) {
        String code = normalizeCode(request.code());
        if (services.existsByCodeIgnoreCase(code)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Service code already exists");
        }
        MedicalService service = new MedicalService();
        service.setId(UUID.randomUUID());
        service.setCode(code);
        applyService(service, request);
        services.save(service);
        audit(actor, "SERVICE", service.getId(), "CREATE");
        return toService(service);
    }

    @Override
    @Transactional
    public CatalogServiceResponse updateService(UUID actor, UUID id, CatalogServiceRequest request) {
        MedicalService service = findService(id);
        String code = normalizeCode(request.code());
        if (!service.getCode().equalsIgnoreCase(code) && services.existsByCodeIgnoreCase(code)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Service code already exists");
        }
        service.setCode(code);
        applyService(service, request);
        audit(actor, "SERVICE", id, "UPDATE");
        return toService(service);
    }

    @Override
    @Transactional
    public CatalogServiceResponse deactivateService(UUID actor, UUID id) {
        MedicalService service = findService(id);
        if (service.isActive()) {
            service.setActive(false);
            audit(actor, "SERVICE", id, "DEACTIVATE");
        }
        return toService(service);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MedicineResponse> medicines() {
        return medicines.findByActiveTrue().stream().map(this::toMedicine).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<MedicineResponse> allMedicines() {
        return medicines.findAll().stream().map(this::toMedicine).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public MedicineResponse medicine(UUID id) {
        return toMedicine(findMedicine(id));
    }

    @Override
    @Transactional
    public MedicineResponse createMedicine(UUID actor, MedicineRequest request) {
        String code = normalizeCode(request.code());
        if (medicines.existsByCodeIgnoreCase(code)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Medicine code already exists");
        }
        Medicine medicine = new Medicine();
        medicine.setId(UUID.randomUUID());
        medicine.setCode(code);
        applyMedicine(medicine, request);
        medicines.save(medicine);
        audit(actor, "MEDICINE", medicine.getId(), "CREATE");
        return toMedicine(medicine);
    }

    @Override
    @Transactional
    public MedicineResponse updateMedicine(UUID actor, UUID id, MedicineRequest request) {
        Medicine medicine = findMedicine(id);
        String code = normalizeCode(request.code());
        if (!medicine.getCode().equalsIgnoreCase(code) && medicines.existsByCodeIgnoreCase(code)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Medicine code already exists");
        }
        medicine.setCode(code);
        applyMedicine(medicine, request);
        audit(actor, "MEDICINE", id, "UPDATE");
        return toMedicine(medicine);
    }

    @Override
    @Transactional
    public MedicineResponse deactivateMedicine(UUID actor, UUID id) {
        Medicine medicine = findMedicine(id);
        if (medicine.isActive()) {
            medicine.setActive(false);
            audit(actor, "MEDICINE", id, "DEACTIVATE");
        }
        return toMedicine(medicine);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PriceResponse> priceHistory(UUID serviceId) {
        findService(serviceId);
        return prices.findByServiceIdOrderByEffectiveFromDesc(serviceId).stream().map(this::toPrice).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PriceResponse priceOn(UUID serviceId, LocalDate on) {
        findService(serviceId);
        LocalDate date = on == null ? LocalDate.now() : on;
        return prices.findByServiceIdOrderByEffectiveFromDesc(serviceId).stream()
                .filter(price -> !price.getEffectiveFrom().isAfter(date))
                .filter(price -> price.getEffectiveUntil() == null || date.isBefore(price.getEffectiveUntil()))
                .findFirst().map(this::toPrice).orElseThrow(() ->
                        new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "No price effective on requested date"));
    }

    @Override
    @Transactional
    public PriceResponse publishPrice(UUID actor, UUID serviceId, PublishPriceRequest request) {
        MedicalService service = services.findLockedById(serviceId).orElseThrow(() ->
                new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Medical service not found"));
        if (!service.isActive()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Cannot price an inactive service");
        }
        validatePrice(request);
        if (request.effectiveUntil() != null && !request.effectiveFrom().isBefore(request.effectiveUntil())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Price end date must be after start date");
        }
        List<ServicePrice> existingPrices = prices.findByServiceIdOrderByEffectiveFromDesc(serviceId);
        ServicePrice previousOpenPrice = null;
        // Validate the entire timeline before mutating anything.
        for (ServicePrice existing : existingPrices) {
            if (!overlaps(existing.getEffectiveFrom(), existing.getEffectiveUntil(),
                    request.effectiveFrom(), request.effectiveUntil())) {
                continue;
            }
            if (!existing.getEffectiveFrom().isBefore(request.effectiveFrom())
                    || existing.getEffectiveUntil() != null || previousOpenPrice != null) {
                throw new BusinessException(ErrorCode.CONFLICT, "Price period overlaps an existing or future price");
            }
            previousOpenPrice = existing;
        }
        if (previousOpenPrice != null) {
            // Preserve the version ID and amount of the preceding price, changing only its end date.
            previousOpenPrice.setEffectiveUntil(request.effectiveFrom());
        }
        ServicePrice price = new ServicePrice();
        price.setId(UUID.randomUUID());
        price.setService(service);
        price.setAmount(request.amount());
        price.setCurrency(request.currency());
        price.setEffectiveFrom(request.effectiveFrom());
        price.setEffectiveUntil(request.effectiveUntil());
        prices.save(price);
        audit(actor, "SERVICE_PRICE", price.getId(), "PUBLISH");
        return toPrice(price);
    }

    private void validatePrice(PublishPriceRequest request) {
        BigDecimal amount = request.amount();
        if (amount == null || amount.signum() < 0 || amount.scale() > 2
                || amount.precision() - amount.scale() > 10) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid monetary amount");
        }
        try {
            if (request.currency() == null || !request.currency().matches("[A-Z]{3}")) {
                throw new IllegalArgumentException("Unknown currency");
            }
            int fractionDigits = Currency.getInstance(request.currency()).getDefaultFractionDigits();
            if (fractionDigits < 0 || amount.stripTrailingZeros().scale() > fractionDigits) {
                throw new IllegalArgumentException("Amount has fractional units not supported by currency");
            }
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Currency must be valid ISO 4217 and amount must follow its fractional precision");
        }
        if (request.effectiveFrom() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Effective start date is required");
        }
    }

    private boolean overlaps(LocalDate firstStart, LocalDate firstEnd, LocalDate secondStart, LocalDate secondEnd) {
        return (firstEnd == null || secondStart.isBefore(firstEnd))
                && (secondEnd == null || firstStart.isBefore(secondEnd));
    }

    private void applyService(MedicalService service, CatalogServiceRequest request) {
        service.setName(request.name().trim());
        service.setDescription(request.description());
        service.setActive(request.active());
    }

    private void applyMedicine(Medicine medicine, MedicineRequest request) {
        medicine.setName(request.name().trim());
        medicine.setUnit(request.unit().trim());
        medicine.setDescription(request.description());
        medicine.setActive(request.active());
    }

    private String normalizeCode(String code) {
        return code.trim().toUpperCase(Locale.ROOT);
    }

    private MedicalService findService(UUID id) {
        return services.findById(id).orElseThrow(() ->
                new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Medical service not found"));
    }

    private Medicine findMedicine(UUID id) {
        return medicines.findById(id).orElseThrow(() ->
                new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Medicine not found"));
    }

    private CatalogServiceResponse toService(MedicalService service) {
        return new CatalogServiceResponse(service.getId(), service.getCode(), service.getName(),
                service.getDescription(), service.isActive());
    }

    private MedicineResponse toMedicine(Medicine medicine) {
        return new MedicineResponse(medicine.getId(), medicine.getCode(), medicine.getName(),
                medicine.getUnit(), medicine.getDescription(), medicine.isActive());
    }

    private PriceResponse toPrice(ServicePrice price) {
        return new PriceResponse(price.getId(), price.getService().getId(), price.getAmount(),
                price.getCurrency(), price.getEffectiveFrom(), price.getEffectiveUntil());
    }

    private void audit(UUID actor, String type, UUID id, String action) {
        AdminAudit entry = new AdminAudit();
        entry.setId(UUID.randomUUID());
        entry.setActorUserId(actor);
        entry.setResourceType(type);
        entry.setResourceId(id);
        entry.setAction(action);
        entry.setCreatedAt(LocalDateTime.now());
        audits.save(entry);
        log.info("Admin {} performed {} on {} {}", actor, action, type, id);
    }
}