package com.clinic.catalog.service.impl;

import com.clinic.catalog.dto.*;
import com.clinic.catalog.entity.*;
import com.clinic.catalog.repository.*;
import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CatalogServiceImplTest {
    @Mock MedicalServiceRepository services;
    @Mock MedicineRepository medicines;
    @Mock ServicePriceRepository prices;
    @Mock AdminAuditRepository audits;
    CatalogServiceImpl catalog;
    UUID actor = UUID.randomUUID();
    UUID serviceId = UUID.randomUUID();

    @BeforeEach
    void setup() {
        catalog = new CatalogServiceImpl(services, medicines, prices, audits);
    }

    @Test
    void createsServiceWithNormalizedUniqueCodeAndAudit() {
        CatalogServiceResponse result = catalog.createService(actor,
                new CatalogServiceRequest("exam-1", " Examination ", null, true));
        assertEquals("EXAM-1", result.code());
        assertEquals("Examination", result.name());
        verify(services).save(any(MedicalService.class));
        verify(audits).save(argThat(audit -> "CREATE".equals(audit.getAction())
                && "SERVICE".equals(audit.getResourceType()) && actor.equals(audit.getActorUserId())));
    }

    @Test
    void deactivatingMedicineKeepsHistoricalRecord() {
        Medicine medicine = new Medicine();
        medicine.setId(UUID.randomUUID());
        medicine.setCode("MED");
        medicine.setName("Medicine");
        medicine.setUnit("tablet");
        medicine.setActive(true);
        when(medicines.findById(medicine.getId())).thenReturn(Optional.of(medicine));
        assertFalse(catalog.deactivateMedicine(actor, medicine.getId()).active());
        verify(medicines, never()).delete(any());
        verify(audits).save(any(AdminAudit.class));
    }

    @Test
    void newPriceClosesPreviousOpenPriceAndKeepsSnapshot() {
        MedicalService service = service();
        when(services.findLockedById(serviceId)).thenReturn(Optional.of(service));
        ServicePrice old = price(service, LocalDate.of(2026, 1, 1), null, "100.00");
        when(prices.findByServiceIdOrderByEffectiveFromDesc(serviceId)).thenReturn(List.of(old));
        PriceResponse result = catalog.publishPrice(actor, serviceId,
                new PublishPriceRequest(new BigDecimal("150.00"), "VND", LocalDate.of(2026, 10, 1), null));
        assertEquals(LocalDate.of(2026, 10, 1), old.getEffectiveUntil());
        assertEquals(new BigDecimal("150.00"), result.amount());
        verify(prices).save(any(ServicePrice.class));
        verify(audits).save(any(AdminAudit.class));
    }

    @Test
    void futurePriceOverlapIsConflict() {
        MedicalService service = service();
        when(services.findLockedById(serviceId)).thenReturn(Optional.of(service));
        when(prices.findByServiceIdOrderByEffectiveFromDesc(serviceId)).thenReturn(List.of(
                price(service, LocalDate.of(2026, 11, 1), null, "200.00")));
        BusinessException ex = assertThrows(BusinessException.class, () -> catalog.publishPrice(actor,
                serviceId, new PublishPriceRequest(new BigDecimal("150.00"), "VND",
                        LocalDate.of(2026, 10, 1), null)));
        assertEquals(ErrorCode.CONFLICT, ex.getErrorCode());
        verify(prices, never()).save(any());
        verifyNoInteractions(audits);
    }

    @Test
    void priceLookupRespectsExclusiveEndDate() {
        MedicalService service = service();
        when(services.findById(serviceId)).thenReturn(Optional.of(service));
        when(prices.findByServiceIdOrderByEffectiveFromDesc(serviceId)).thenReturn(List.of(
                price(service, LocalDate.of(2026, 10, 1), null, "150.00"),
                price(service, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 10, 1), "100.00")));
        assertEquals(new BigDecimal("100.00"), catalog.priceOn(serviceId, LocalDate.of(2026, 9, 30)).amount());
        assertEquals(new BigDecimal("150.00"), catalog.priceOn(serviceId, LocalDate.of(2026, 10, 1)).amount());
    }

    @Test
    void listsOnlyActiveCatalogEntriesButAllowsHistoricalDetail() {
        MedicalService active = service();
        Medicine activeMedicine = new Medicine();
        activeMedicine.setId(UUID.randomUUID());
        activeMedicine.setCode("MED");
        activeMedicine.setName("Medicine");
        activeMedicine.setUnit("tablet");
        activeMedicine.setActive(true);
        when(services.findByActiveTrue()).thenReturn(List.of(active));
        when(medicines.findByActiveTrue()).thenReturn(List.of(activeMedicine));
        assertEquals(1, catalog.services().size());
        assertEquals(1, catalog.medicines().size());
        verify(services, never()).findAll();
        verify(medicines, never()).findAll();

        active.setActive(false);
        when(services.findById(serviceId)).thenReturn(Optional.of(active));
        assertFalse(catalog.service(serviceId).active());
    }

    @Test
    void adminListsIncludeDeactivatedItems() {
        MedicalService inactiveService = service();
        inactiveService.setActive(false);
        Medicine inactiveMedicine = new Medicine();
        inactiveMedicine.setId(UUID.randomUUID());
        inactiveMedicine.setCode("OLD_MED");
        inactiveMedicine.setName("Old Medicine");
        inactiveMedicine.setUnit("tablet");
        inactiveMedicine.setActive(false);
        when(services.findAll()).thenReturn(List.of(inactiveService));
        when(medicines.findAll()).thenReturn(List.of(inactiveMedicine));
        assertFalse(catalog.allServices().getFirst().active());
        assertFalse(catalog.allMedicines().getFirst().active());
    }

    @Test
    void priceIdIsStableVersionIdentifierOnDateLookup() {
        MedicalService service = service();
        ServicePrice old = price(service, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 10, 1), "100.00");
        when(services.findById(serviceId)).thenReturn(Optional.of(service));
        when(prices.findByServiceIdOrderByEffectiveFromDesc(serviceId)).thenReturn(List.of(old));
        assertEquals(old.getId(), catalog.priceOn(serviceId, LocalDate.of(2026, 9, 30)).id());
    }

    @Test
    void rejectsOverlappingFinitePeriodWithoutChangingExistingPrice() {
        MedicalService service = service();
        ServicePrice old = price(service, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 1), "100.00");
        when(services.findLockedById(serviceId)).thenReturn(Optional.of(service));
        when(prices.findByServiceIdOrderByEffectiveFromDesc(serviceId)).thenReturn(List.of(old));
        var request = new PublishPriceRequest(new BigDecimal("150.00"), "VND",
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 11, 1));
        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> catalog.publishPrice(actor, serviceId, request)).getErrorCode());
        assertEquals(LocalDate.of(2026, 12, 1), old.getEffectiveUntil());
        verify(prices, never()).save(any());
    }

    @Test
    void adjacentPriceIntervalsAreValid() {
        MedicalService service = service();
        ServicePrice old = price(service, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 10, 1), "100.00");
        when(services.findLockedById(serviceId)).thenReturn(Optional.of(service));
        when(prices.findByServiceIdOrderByEffectiveFromDesc(serviceId)).thenReturn(List.of(old));
        PriceResponse result = catalog.publishPrice(actor, serviceId,
                new PublishPriceRequest(new BigDecimal("120.00"), "VND", LocalDate.of(2026, 10, 1), null));
        assertEquals(LocalDate.of(2026, 10, 1), old.getEffectiveUntil());
        assertNotEquals(old.getId(), result.id());
    }

    @Test
    void rejectsInvalidCurrencyAmountAndDateWithoutWriting() {
        when(services.findLockedById(serviceId)).thenReturn(Optional.of(service()));
        LocalDate start = LocalDate.of(2026, 10, 1);
        for (PublishPriceRequest invalid : List.of(
                new PublishPriceRequest(new BigDecimal("-1.00"), "VND", start, null),
                new PublishPriceRequest(new BigDecimal("1.001"), "VND", start, null),
                new PublishPriceRequest(new BigDecimal("100000000000.00"), "VND", start, null),
                new PublishPriceRequest(BigDecimal.ONE, "ZZZ", start, null),
                new PublishPriceRequest(BigDecimal.ONE, "usd", start, null),
                new PublishPriceRequest(new BigDecimal("1.50"), "JPY", start, null),
                new PublishPriceRequest(BigDecimal.ONE, "USD", start, start))) {
            assertEquals(ErrorCode.VALIDATION_ERROR, assertThrows(BusinessException.class,
                    () -> catalog.publishPrice(actor, serviceId, invalid)).getErrorCode());
        }
        verifyNoInteractions(prices, audits);
    }

    private MedicalService service() {
        MedicalService service = new MedicalService();
        service.setId(serviceId);
        service.setCode("EXAM");
        service.setName("Examination");
        service.setActive(true);
        return service;
    }

    private ServicePrice price(MedicalService service, LocalDate from, LocalDate until, String amount) {
        ServicePrice price = new ServicePrice();
        price.setId(UUID.randomUUID());
        price.setService(service);
        price.setAmount(new BigDecimal(amount));
        price.setCurrency("VND");
        price.setEffectiveFrom(from);
        price.setEffectiveUntil(until);
        return price;
    }
}