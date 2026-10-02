package com.clinic.v2.catalog.security;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;
import java.util.UUID;

@Component
public class TenantDbContext {
    private final EntityManager em;
    public TenantDbContext(EntityManager em){this.em=em;}
    public void tenant(UUID clinicId){
        em.createNativeQuery("select set_config('app.clinic_id', :clinic, true)")
            .setParameter("clinic",clinicId.toString()).getSingleResult();
    }
}
