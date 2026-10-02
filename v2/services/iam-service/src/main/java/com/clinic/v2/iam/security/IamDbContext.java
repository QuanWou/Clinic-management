package com.clinic.v2.iam.security;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;
import java.util.UUID;

@Component
public class IamDbContext {
    private final EntityManager em;
    public IamDbContext(EntityManager em){this.em=em;}

    public void self(UUID userId){ set("self",userId,null); }
    public void tenant(UUID actorUserId,UUID clinicId){
        if(actorUserId==null || clinicId==null) throw new IllegalArgumentException("Verified actor and clinic context required");
        set("tenant",actorUserId,clinicId);
    }
    public void system(){ set("system",null,null); }

    private void set(String mode,UUID userId,UUID clinicId){
        em.createNativeQuery("select set_config('app.access_mode', :mode, true)")
            .setParameter("mode",mode).getSingleResult();
        em.createNativeQuery("select set_config('app.user_id', :user, true)")
            .setParameter("user",userId==null?"":userId.toString()).getSingleResult();
        em.createNativeQuery("select set_config('app.clinic_id', :clinic, true)")
            .setParameter("clinic",clinicId==null?"":clinicId.toString()).getSingleResult();
    }
}
