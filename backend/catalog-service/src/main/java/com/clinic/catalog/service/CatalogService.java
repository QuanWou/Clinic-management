package com.clinic.catalog.service;

import com.clinic.catalog.dto.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface CatalogService {
    List<CatalogServiceResponse> services();
    List<CatalogServiceResponse> allServices();
    CatalogServiceResponse service(UUID id);
    CatalogServiceResponse createService(UUID actor, CatalogServiceRequest request);
    CatalogServiceResponse updateService(UUID actor, UUID id, CatalogServiceRequest request);
    CatalogServiceResponse deactivateService(UUID actor, UUID id);
    List<MedicineResponse> medicines();
    List<MedicineResponse> allMedicines();
    MedicineResponse medicine(UUID id);
    MedicineResponse createMedicine(UUID actor, MedicineRequest request);
    MedicineResponse updateMedicine(UUID actor, UUID id, MedicineRequest request);
    MedicineResponse deactivateMedicine(UUID actor, UUID id);
    List<PriceResponse> priceHistory(UUID serviceId);
    PriceResponse priceOn(UUID serviceId, LocalDate on);
    PriceResponse publishPrice(UUID actor, UUID serviceId, PublishPriceRequest request);
}