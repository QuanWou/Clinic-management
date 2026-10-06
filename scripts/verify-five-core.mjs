// Read-only verification; login is the sole POST. Never log tokens or patient payloads.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cfg=JSON.parse(fs.readFileSync(path.join(root,'.runtime/main/config.json'),'utf8').replace(/^\uFEFF/,''));
const base='http://127.0.0.1:4176';
const scope=`/api/clinics/${cfg.clinic}/branches/${cfg.branch}`;
async function read(url,token){const r=await fetch(base+url,{headers:token?{Authorization:`Bearer ${token}`}:{}});assert.equal(r.status,200,url+' HTTP '+r.status);return r.json();}
async function login(role){const a=cfg.accounts[role];const r=await fetch(base+'/s1/auth/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:a.email,password:a.password})});assert.equal(r.status,200,'Login '+role);const j=await r.json();return j.data.accessToken;}
const patient=await login('patient'),doctor=await login('doctor'),reception=await login('reception');
await read('/s1/identity/api/me/current',patient);
await read('/s1/patient/api/me/patient-profile',patient);
await read('/s1/notification/api/me/notifications',patient);
await read(`/s1/search/api/public/clinics/${cfg.clinic}/doctors`);
await read(`/s1/search/api/public/clinics/${cfg.clinic}/offerings`);
const work=await read('/s1/encounter'+scope+'/doctor/worklist',doctor);
const visits=Array.isArray(work)?work:(work.data??[]);
let medicalRead=false;
if(visits.length){const visit=visits[0];await read('/s1/medical'+scope+`/visits/${visit.id}/orders`,doctor);medicalRead=true;}
for(const token of [undefined,patient]){const r=await fetch(base+'/s1/encounter'+scope+'/doctor/worklist',{headers:token?{Authorization:`Bearer ${token}`}:{}});assert.ok([401,403].includes(r.status),'Protected worklist must deny unauthorized caller');}
await read('/s1/identity/api/me/contexts',reception);
assert.equal((await fetch(base+'/s1/unknown/api/test')).status,404);
assert.equal((await fetch(base+'/s1/patient/actuator/env')).status,404);
console.log(JSON.stringify({status:'PASS',gateway:true,patientProfile:true,notifications:true,publicSearch:true,doctorWorklist:true,medicalRead,authorizationDenials:true,businessWrites:0}));
