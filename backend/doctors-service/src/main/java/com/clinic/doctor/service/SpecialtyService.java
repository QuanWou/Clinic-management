package com.clinic.doctor.service;

import com.clinic.doctor.dto.SpecialtyResponse;
import com.clinic.doctor.entity.Specialty;
import com.clinic.doctor.repository.SpecialtyRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class SpecialtyService {

    private final SpecialtyRepository specialtyRepository;

    public SpecialtyService(SpecialtyRepository specialtyRepository) {
        this.specialtyRepository = specialtyRepository;
    }

    @Transactional(readOnly = true)
    public List<SpecialtyResponse> getSpecialties() {
        return specialtyRepository.findAll(Sort.by(Sort.Direction.ASC, "name"))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private SpecialtyResponse toResponse(Specialty specialty) {
        return new SpecialtyResponse(specialty.getId(), specialty.getName(), specialty.getDescription());
    }
}
