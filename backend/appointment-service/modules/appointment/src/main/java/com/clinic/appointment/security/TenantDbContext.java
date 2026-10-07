package com.clinic.appointment.security;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;
@Component
public class TenantDbContext{
 private final EntityManager em;public TenantDbContext(EntityManager em){this.em=em;}
 public void tenant(java.util.UUID clinicId){
  em.createNativeQuery("select set_config('app.clinic_id', :clinic, true)").setParameter("clinic",clinicId.toString()).getSingleResult();
 }
 public void lockDoctor(java.util.UUID doctorId){
  em.createNativeQuery("select pg_advisory_xact_lock(hashtextextended(:key,0))")
    .setParameter("key","booking-doctor:"+doctorId).getSingleResult();
 }
 public void lockKey(java.util.UUID patientId,String operation,String key){
  em.createNativeQuery("select pg_advisory_xact_lock(hashtextextended(:key,0))")
   .setParameter("key","booking-key:"+patientId+":"+operation+":"+key).getSingleResult();
 }
}
