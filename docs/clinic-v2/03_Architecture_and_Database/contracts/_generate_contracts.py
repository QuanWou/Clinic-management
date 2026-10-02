import json, yaml
from pathlib import Path
p=Path(__file__).parent
ref=lambda k:{'$ref':'#/components/schemas/'+k}
par=lambda k:{'$ref':'#/components/parameters/'+k}
resp=lambda schema,desc='OK',code='200':{code:{'description':desc,'content':{'application/json':{'schema':ref(schema)}}},'default':{'$ref':'#/components/responses/Error'}}
body=lambda k:{'required':True,'content':{'application/json':{'schema':ref(k)}}}
get=lambda summary,tags,response,parameters=None,public=False:{'summary':summary,'tags':tags,'parameters':parameters or [],'responses':resp(response),**({'security':[]} if public else {})}
post=lambda summary,tags,request,response,parameters=None,code='201',public=False:{'summary':summary,'tags':tags,'parameters':parameters or [],'requestBody':body(request),'responses':resp(response,'Created' if code=='201' else 'Accepted',code),**({'security':[]} if public else {})}
obj=lambda props,required=[]:{'type':'object','additionalProperties':False,'properties':props,'required':required}
s=lambda **kw:{'type':'string',**kw}
uuid=s(format='uuid'); dt=s(format='date-time'); status=s(); vnd={'type':'integer','format':'int64','minimum':0,'description':'Integer Vietnamese dong; no floating-point currency.'}
clinic_branch=[par('ClinicHeader'),par('BranchHeader')]
idem=[par('IdempotencyKey')]
path_id=lambda name:{'name':name,'in':'path','required':True,'schema':uuid}
common={'clinicId':uuid,'branchId':uuid}
S={
'Error':obj({'error':obj({'code':s(),'message':s(),'requestId':s(),'details':{'type':'object','additionalProperties':True}},['code','message','requestId'])},['error']),
'ContextList':obj({'contexts':{'type':'array','items':obj({'clinicId':uuid,'branchIds':{'type':'array','items':uuid},'roles':{'type':'array','items':s()},'membershipVersion':{'type':'integer'}},['clinicId','roles'])}},['contexts']),
'ClinicSubmission':obj({'name':s(minLength=2),'licenseReference':s(),'contactEmail':s(format='email'),'branches':{'type':'array','items':obj({'name':s(),'address':s(),'timezone':s(default='Asia/Ho_Chi_Minh')},['name','address'])}},['name','licenseReference','branches']),
'Clinic':obj({'id':uuid,'name':s(),'status':s(),'publicationStatus':s()},['id','name','status']),
'ClinicList':obj({'items':{'type':'array','items':ref('Clinic')},'nextCursor':s(nullable=True)},['items']),
'ApprovalRequest':obj({'reason':s(),'publicationApproved':{'type':'boolean'}},['reason','publicationApproved']),
'Availability':obj({'slotId':uuid,'clinicId':uuid,'branchId':uuid,'doctorId':uuid,'startsAt':dt,'endsAt':dt,'available':{'type':'boolean'},'quotedAmountVnd':vnd,'sourceVersion':{'type':'integer'}},['slotId','clinicId','branchId','startsAt','endsAt','available']),
'AvailabilityList':obj({'items':{'type':'array','items':ref('Availability')},'asOf':dt},['items','asOf']),
'HoldRequest':obj({**common,'slotId':uuid,'doctorId':uuid,'serviceId':uuid,'patientId':uuid},['clinicId','branchId','slotId','serviceId','patientId']),
'Hold':obj({'holdId':uuid,'slotId':uuid,'status':s(enum=['active','consumed','expired','released']),'expiresAt':dt,'priceSnapshot':obj({'amountVnd':vnd,'currency':s(enum=['VND']),'priceVersionId':uuid},['amountVnd','currency','priceVersionId'])},['holdId','slotId','status','expiresAt']),
'AppointmentRequest':obj({'holdId':uuid,'patientId':uuid,'paymentPolicyAcknowledged':{'type':'boolean'}},['holdId','patientId','paymentPolicyAcknowledged']),
'Appointment':obj({'id':uuid,**common,'patientId':uuid,'slotId':uuid,'status':s(enum=['pending_confirmation','pending_payment','confirmed','checked_in','fulfilled','cancelled','rescheduled','no_show']),'expiresAt':dt,'appointmentCode':s()},['id','clinicId','branchId','patientId','status']),
'ReasonRequest':obj({'reason':s(minLength=2)},['reason']),
'RescheduleRequest':obj({'newHoldId':uuid,'reason':s(minLength=2),'expectedVersion':{'type':'integer','minimum':1}},['newHoldId','reason','expectedVersion']),
'WalkinPatientRequest':obj({'clinicId':uuid,'branchId':uuid,'name':s(minLength=1),'phone':s(),'dateOfBirth':s(format='date'),'matchingReviewed':{'type':'boolean'}},['clinicId','branchId','name','matchingReviewed']),
'PatientLink':obj({'patientId':uuid,'clinicPatientLinkId':uuid,'verificationStatus':s()},['patientId','clinicPatientLinkId','verificationStatus']),
'VisitRequest':obj({'clinicId':uuid,'branchId':uuid,'clinicPatientLinkId':uuid,'serviceId':uuid,'doctorId':uuid},['clinicId','branchId','clinicPatientLinkId','serviceId']),
'Visit':obj({'id':uuid,**common,'patientId':uuid,'appointmentId':uuid,'source':s(enum=['booking','walk_in']),'status':s(enum=['waiting','in_progress','awaiting_results','clinically_completed','closed','cancelled','transferred']),'queueTicketId':uuid,'queueNumber':{'type':'integer'}},['id','clinicId','branchId','patientId','source','status']),
'CheckinRequest':obj({'branchId':uuid,'identityVerified':{'type':'boolean'}},['branchId','identityVerified']),
'OrderRequest':obj({'offeringId':uuid,'clinicalReason':s(minLength=1),'priceVersionId':uuid},['offeringId','clinicalReason']),
'ClinicalOrder':obj({'id':uuid,'encounterId':uuid,'status':s(enum=['ordered','accepted','processing','resulted','reviewed','cancelled','rejected'])},['id','encounterId','status']),
'ResultRequest':obj({'summary':s(),'attachmentId':uuid,'resultedAt':dt},['summary','resultedAt']),
'ReviewRequest':obj({'reviewNote':s(),'decision':s(enum=['acknowledged','repeat_test','follow_up'])},['decision']),
'DocumentAction':obj({'expectedVersion':{'type':'integer','minimum':1},'reason':s()},['expectedVersion']),
'DocumentVersion':obj({'documentId':uuid,'versionId':uuid,'status':s(enum=['draft','validated','signed','released']),'contentHash':s()},['documentId','versionId','status']),
'Bill':obj({'id':uuid,'clinicId':uuid,'branchId':uuid,'totalVnd':vnd,'paidVnd':vnd,'remainingVnd':vnd,'status':s()},['id','clinicId','totalVnd','paidVnd','remainingVnd','status']),
'PaymentIntentRequest':obj({'billId':uuid,'amountVnd':vnd,'collectionMode':s(enum=['clinic_merchant','platform_on_behalf'])},['billId','amountVnd','collectionMode']),
'PaymentIntent':obj({'id':uuid,'billId':uuid,'amountVnd':vnd,'merchantId':s(),'status':s(enum=['initiated','pending','succeeded','failed','cancelled','unknown']),'providerRedirectUrl':s(format='uri')},['id','billId','amountVnd','merchantId','status']),
'OnsitePaymentRequest':obj({'billId':uuid,'amountVnd':vnd,'method':s(enum=['cash','transfer','pos']),'shiftId':uuid,'reference':s()},['billId','amountVnd','method','shiftId']),
'PaymentReceipt':obj({'paymentId':uuid,'billId':uuid,'amountVnd':vnd,'receiptLabel':s(enum=['internal_receipt']),'status':s()},['paymentId','billId','amountVnd','receiptLabel']),
'RefundRequest':obj({'paymentId':uuid,'amountVnd':vnd,'reason':s(minLength=2),'approvalId':uuid},['paymentId','amountVnd','reason','approvalId']),
'Refund':obj({'id':uuid,'paymentId':uuid,'amountVnd':vnd,'status':s(enum=['requested','approved','processing','succeeded','failed'])},['id','paymentId','amountVnd','status']),
'WebhookAck':obj({'accepted':{'type':'boolean'},'requestId':s()},['accepted']),
'AppointmentList':obj({'items':{'type':'array','items':ref('Appointment')},'nextCursor':s()},['items']),
'ReleasedDocument':obj({'documentId':uuid,'versionId':uuid,'releasedAt':dt,'downloadLink':s(format='uri')},['documentId','versionId','releasedAt']),
'ReleasedDocumentList':obj({'items':{'type':'array','items':ref('ReleasedDocument')}},['items'])
}
# remove deprecated nullable to pure JSON-schema union? OpenAPI 3.1 supports nullable from legacy but use oneOf.
S['ClinicList']['properties']['nextCursor']={'oneOf':[s(),{'type':'null'}]}
paths={
'/me/contexts':{'get':get('List current verified clinic/branch contexts',['Identity'],'ContextList')},
'/clinics':{'post':post('Submit clinic onboarding draft',['Clinic'],'ClinicSubmission','Clinic',idem)},
'/platform/clinics/{clinicId}/approve':{'post':post('Approve clinic publication (platform operator)',['Clinic'],'ApprovalRequest','Clinic',[path_id('clinicId'),*idem],code='200')},
'/public/clinics':{'get':get('Search approved clinics',['Public'],'ClinicList',[{'name':'q','in':'query','schema':s()}, {'name':'cursor','in':'query','schema':s()}],public=True)},
'/public/clinics/{clinicId}':{'get':get('Approved clinic detail',['Public'],'Clinic',[path_id('clinicId')],public=True)},
'/public/availability':{'get':get('Public availability hint; booking rechecks slot authority',['Public'],'AvailabilityList',[{'name':'clinicId','in':'query','required':True,'schema':uuid},{'name':'branchId','in':'query','required':True,'schema':uuid},{'name':'serviceId','in':'query','required':True,'schema':uuid}],public=True)},
'/appointments/holds':{'post':post('Reserve a slot atomically',['Appointment'],'HoldRequest','Hold',idem)},
'/appointments':{'post':post('Consume hold or start pending deposit flow',['Appointment'],'AppointmentRequest','Appointment',idem)},
'/appointments/{appointmentId}':{'get':get('Read authorized appointment',['Appointment'],'Appointment',[path_id('appointmentId')])},
'/appointments/{appointmentId}/cancel':{'post':post('Cancel with financial policy evaluation',['Appointment'],'ReasonRequest','Appointment',[path_id('appointmentId'),*idem],code='200')},
'/appointments/{appointmentId}/reschedule':{'post':post('Acquire new hold and atomically swap slot',['Appointment'],'RescheduleRequest','Appointment',[path_id('appointmentId'),*idem],code='200')},
'/patients/walk-in':{'post':post('Create verified or provisional clinic patient link',['Patient'],'WalkinPatientRequest','PatientLink',[*clinic_branch,*idem])},
'/visits/walk-in':{'post':post('Create visit + check-in + queue without appointment',['Encounter'],'VisitRequest','Visit',[*clinic_branch,*idem])},
'/appointments/{appointmentId}/check-in':{'post':post('Idempotently check in booked patient',['Encounter'],'CheckinRequest','Visit',[path_id('appointmentId'),*clinic_branch,*idem])},
'/visits/{visitId}':{'get':get('Read visit scoped to care assignment',['Encounter'],'Visit',[path_id('visitId'),*clinic_branch])},
'/visits/{visitId}/start':{'post':post('Assigned clinician starts encounter',['Encounter'],'ReasonRequest','Visit',[path_id('visitId'),*clinic_branch,*idem],code='200')},
'/visits/{visitId}/orders':{'post':post('Create clinical order',['Medical'],'OrderRequest','ClinicalOrder',[path_id('visitId'),*clinic_branch,*idem])},
'/orders/{orderId}/results':{'post':post('Enter result by assigned lab staff',['Medical'],'ResultRequest','ClinicalOrder',[path_id('orderId'),*clinic_branch,*idem],code='200')},
'/orders/{orderId}/reviews':{'post':post('Assigned doctor reviews result',['Medical'],'ReviewRequest','ClinicalOrder',[path_id('orderId'),*clinic_branch,*idem],code='200')},
'/visits/{visitId}/documents/{documentId}/sign':{'post':post('Sign immutable document version',['Medical'],'DocumentAction','DocumentVersion',[path_id('visitId'),path_id('documentId'),*clinic_branch,*idem],code='200')},
'/documents/{documentId}/release':{'post':post('Release signed document for authorized portal access',['Medical'],'DocumentAction','DocumentVersion',[path_id('documentId'),*clinic_branch,*idem],code='200')},
'/bills/{billId}':{'get':get('Read bill by authorization scope',['Billing'],'Bill',[path_id('billId')])},
'/payment-intents':{'post':post('Create online intent using server-owned merchant configuration',['Billing'],'PaymentIntentRequest','PaymentIntent',idem)},
'/payments/onsite':{'post':post('Record verified direct clinic payment',['Billing'],'OnsitePaymentRequest','PaymentReceipt',[*clinic_branch,*idem])},
'/refunds':{'post':post('Request approved refund against original payment',['Billing'],'RefundRequest','Refund',[*clinic_branch,*idem],code='202')},
'/webhooks/payments/{provider}':{'post':{'summary':'Verified payment provider webhook; raw body signature and provider-event dedupe enforced','tags':['Billing'],'security':[],'parameters':[{'name':'provider','in':'path','required':True,'schema':s()}, {'name':'X-Provider-Signature','in':'header','required':True,'schema':s()}],'requestBody':{'required':True,'content':{'application/json':{'schema':{'type':'object','additionalProperties':True}}}},'responses':resp('WebhookAck','Acknowledged','200')}},
'/me/appointments':{'get':get('Patient or verified guardian appointments',['Portal'],'AppointmentList')},
'/me/records/{visitId}/released-documents':{'get':get('Released documents authorized by owning clinic',['Portal'],'ReleasedDocumentList',[path_id('visitId')])}
}
api={'openapi':'3.1.1','info':{'title':'Clinic Management V2 - Representative High-Risk Contracts','version':'0.9.0','description':'Architecture draft. Representative routes only; per-service exhaustive contracts and legal/medical sign-off required. A staff tenant header is a request, not an authority token.'},'servers':[{'url':'https://api.example.invalid/api/v2','description':'Placeholder, not a deployed service'}],'tags':[{'name':x} for x in ['Identity','Clinic','Public','Appointment','Patient','Encounter','Medical','Billing','Portal']],'security':[{'bearerAuth':[]}],'paths':paths,'components':{'securitySchemes':{'bearerAuth':{'type':'http','scheme':'bearer','bearerFormat':'JWT'}},'parameters':{'ClinicHeader':{'name':'X-Clinic-Id','in':'header','required':True,'description':'Requested active tenant; verify server-side membership and resource ownership.','schema':uuid},'BranchHeader':{'name':'X-Branch-Id','in':'header','required':True,'description':'Requested branch within clinic; verify scope.','schema':uuid},'IdempotencyKey':{'name':'Idempotency-Key','in':'header','required':True,'schema':s(minLength=16,maxLength=128)}},'responses':{'Error':{'description':'Structured error','content':{'application/json':{'schema':ref('Error')}}}},'schemas':S}}
# Stable operation IDs and top-level requirement traceability for generated client tests.
req_map={
'/me/contexts':['FR-IAM-02'], '/clinics':['FR-ORG-01'], '/platform/clinics/{clinicId}/approve':['FR-ORG-02'],
'/public/clinics':['FR-PUB-01'], '/public/clinics/{clinicId}':['FR-PUB-02'], '/public/availability':['FR-PUB-04'],
'/appointments/holds':['FR-SCH-02'], '/appointments':['FR-PUB-05','FR-SCH-04'],
'/appointments/{appointmentId}':['FR-PUB-06'], '/appointments/{appointmentId}/cancel':['FR-SCH-03'],
'/appointments/{appointmentId}/reschedule':['FR-SCH-05'], '/patients/walk-in':['FR-IAM-06'],
'/visits/walk-in':['FR-SCH-06','FR-MED-01'], '/appointments/{appointmentId}/check-in':['FR-SCH-07'],
'/visits/{visitId}':['FR-MED-02'], '/visits/{visitId}/start':['FR-MED-02'],
'/visits/{visitId}/orders':['FR-MED-05'], '/orders/{orderId}/results':['FR-MED-06'],
'/orders/{orderId}/reviews':['FR-MED-07'], '/visits/{visitId}/documents/{documentId}/sign':['FR-MED-09'],
'/documents/{documentId}/release':['FR-MED-09','FR-PUB-07'], '/bills/{billId}':['FR-BIL-02'],
'/payment-intents':['FR-BIL-04','FR-BIL-05'], '/payments/onsite':['FR-BIL-03'],
'/refunds':['FR-BIL-08'], '/webhooks/payments/{provider}':['FR-BIL-04','FR-BIL-11'],
'/me/appointments':['FR-PUB-06'], '/me/records/{visitId}/released-documents':['FR-PUB-07']}
import re
for path,item in api['paths'].items():
    for method,operation in item.items():
        operation['operationId']=method+'_'+re.sub(r'[^a-zA-Z0-9]+','_',path).strip('_')
        operation['x-prd-requirements']=req_map.get(path,[])
(p/'openapi.yaml').write_text(yaml.safe_dump(api,sort_keys=False,allow_unicode=True,width=110),encoding='utf-8')
event={'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'https://contracts.example.invalid/clinic-v2/event-envelope.schema.json','title':'Clinic V2 non-PHI integration event envelope','type':'object','additionalProperties':False,'required':['specversion','id','source','type','subject','time','datacontenttype','clinicid','correlationid','aggregateversion','data'],'properties':{'specversion':{'const':'1.0'},'id':{'type':'string','format':'uuid'},'source':{'type':'string','minLength':1},'type':{'type':'string','pattern':'^clinic\\.[a-z_]+\\.[a-z_]+\\.v[1-9][0-9]*$'},'subject':{'type':'string','minLength':1},'time':{'type':'string','format':'date-time'},'datacontenttype':{'const':'application/json'},'clinicid':{'type':'string','format':'uuid'},'branchid':{'type':['string','null'],'format':'uuid'},'correlationid':{'type':'string','minLength':1},'causationid':{'type':'string'},'aggregateversion':{'type':'integer','minimum':1},'data':{'type':'object','additionalProperties':True,'description':'Only minimal safe metadata: IDs, states, amount where necessary. Do not include contact details, diagnosis or clinical body.'}}}
(p/'event-envelope.schema.json').write_text(json.dumps(event,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
cat={'version':'0.9.0','producerValidation':'workload credential + event schema + aggregate ownership; consumers reestablish tenant scope','events':[
 {'type':t,'owner':o,'payloadRequired':fields,'consumers':cons} for t,o,fields,cons in [
 ('clinic.clinic.published.v1','Clinic',['clinicId','publicationVersion'],['Search','Appointment']),
 ('clinic.clinic.suspended.v1','Clinic',['clinicId','reasonCode'],['Search','Appointment','Notification']),
 ('clinic.doctor.schedule_changed.v1','Doctor',['doctorId','clinicId','branchId','scheduleVersion'],['Appointment','Search']),
 ('clinic.catalog.price_published.v1','Catalog',['offeringId','branchId','priceVersionId','amountVnd'],['Appointment','Search']),
 ('clinic.appointment.confirmed.v1','Appointment',['appointmentId','clinicId','branchId','patientRef','slotId'],['Encounter','Notification','Search']),
 ('clinic.appointment.cancelled.v1','Appointment',['appointmentId','reasonCode'],['Billing','Notification','Search']),
 ('clinic.encounter.checked_in.v1','Encounter',['visitId','appointmentId','branchId'],['Medical','Notification']),
 ('clinic.medical.order_placed.v1','Medical',['orderId','visitId','offeringId','priceVersionId'],['Billing']),
 ('clinic.medical.result_released.v1','Medical',['orderId','resultId','visitId'],['MedicalWorklist']),
 ('clinic.medical.document_released.v1','Medical',['documentId','versionId','visitId'],['Portal','Notification']),
 ('clinic.billing.payment_succeeded.v1','Billing',['paymentId','intentId','billId','amountVnd'],['Appointment','Portal']),
 ('clinic.billing.refund_succeeded.v1','Billing',['refundId','originalPaymentId','amountVnd'],['Appointment','Portal']),
 ('clinic.identity.membership_revoked.v1','Identity',['membershipId','userId','clinicId','membershipVersion'],['AuthCache']),
 ] ]}
(p/'event-catalog.yaml').write_text(yaml.safe_dump(cat,sort_keys=False,allow_unicode=True),encoding='utf-8')
print('Generated endpoints',sum(len(x) for x in paths.values()),'schemas',len(S),'event types',len(cat['events']))
