package com.clinic.clinic.security;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;
import java.util.UUID;

@Component
public class TenantDbContext {
    private final EntityManager em;
    public TenantDbContext(EntityManager em){this.em=em;}

    public void tenant(UUID clinicId){
        if(clinicId==null) throw new IllegalArgumentException("Verified clinic context required");
        set("tenant",clinicId,null);
    }
    public void ownerIndex(UUID userId){
        if(userId==null) throw new IllegalArgumentException("Verified user context required");
        set("owner_index",null,userId);
    }
    public void platform(){set("platform",null,null);}
    public void publicRead(){set("public",null,null);}
    public void system(){set("system",null,null);}

    private void set(String mode,UUID clinicId,UUID userId){
        // true = transaction-local. The value disappears on COMMIT/ROLLBACK and cannot leak through the pool.
        em.createNativeQuery("select set_config('app.access_mode', :mode, true)")
            .setParameter("mode",mode).getSingleResult();
        em.createNativeQuery("select set_config('app.clinic_id', :clinic, true)")
            .setParameter("clinic",clinicId==null?"":clinicId.toString()).getSingleResult();
        em.createNativeQuery("select set_config('app.user_id', :user, true)")
            .setParameter("user",userId==null?"":userId.toString()).getSingleResult();
    }
}
