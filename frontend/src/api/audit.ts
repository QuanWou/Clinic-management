import {requestJson} from './client';
import {unwrap} from './booking';

const base=import.meta.env.VITE_AUDIT_URL??'/s1/audit';

export type AdminAuditEvent={
 id:string;
 branchId:string|null;
 actorUserId:string;
 category:string;
 action:string;
 resourceType:string;
 resourceId:string;
 outcome:string;
 correlationId:string;
 occurredAt:string;
};

export const events=(token:string,clinicId:string,limit=200)=>
 unwrap(requestJson<AdminAuditEvent[]>(
  `${base}/api/clinics/${encodeURIComponent(clinicId)}/audit-events?limit=${Math.max(1,Math.min(200,limit))}`,
  {headers:{Authorization:`Bearer ${token}`}}
 ));
