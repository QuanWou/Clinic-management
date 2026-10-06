package com.clinic.clinic.security;

import org.springframework.stereotype.Component;

@Component
public class PlatformAccess {
    private final IamAuthorizationClient iam;
    public PlatformAccess(IamAuthorizationClient iam){this.iam=iam;}

    public boolean allowed(Actor actor){
        return actor!=null && actor.id()!=null &&
            iam.allowed(actor.id(),"PLATFORM_CLINIC_REVIEW",null,null);
    }
}
