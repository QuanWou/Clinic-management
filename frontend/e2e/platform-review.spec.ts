import { test,expect } from '@playwright/test';
import path from 'node:path';
test('platform reads actual review-shaped source data and requires independent evidence confirmation on mobile',async({page})=>{
 let approved=false;let writes=0;const clinic=()=>({id:'clinic',ownerUserId:'owner',name:'Synthetic submitted clinic',slug:'synthetic-submitted',reviewStatus:approved?'APPROVED':'SUBMITTED',publicationStatus:'UNPUBLISHED',evidenceVerified:approved,version:1,contactName:'Synthetic owner',contactEmail:'synthetic@example.invalid',contactPhone:'000CONTACT',license:{licenseNumber:'SYNTHETIC',issuingAuthority:'Synthetic authority',scopeSummary:'Synthetic scope',evidenceRef:'private/synthetic-evidence',validUntil:'2027-10-01'},branches:[{id:'branch',name:'Synthetic local point',address:'Synthetic address',openingHours:'08-17',active:true}]});
 await page.route('**/s1/**',async route=>{const url=route.request().url();let json:unknown={};
  if(url.endsWith('/auth/login'))json={data:{accessToken:'synthetic-platform-token'}};
  else if(url.endsWith('/me/contexts'))json=[];
  else if(url.endsWith('/me/current'))json={userId:'operator',legacyRoles:['ROLE_USER'],platformOperator:true};
  else if(url.endsWith('/platform/clinics/capabilities'))json={publicationEnabled:false};
  else if(url.includes('/platform/clinics?'))json={content:[clinic()],number:0,size:20,totalPages:1,totalElements:1};
  else if(url.endsWith('/platform/clinics/clinic'))json=clinic();
  else if(url.endsWith('/clinics/clinic/reviews'))json=[{id:'review',actorUserId:'operator',action:approved?'APPROVED':'SUBMITTED',reason:'Synthetic source review',occurredAt:'2026-10-02T01:00:00Z'}];
  else if(url.endsWith('/approve')){const body=route.request().postDataJSON();expect(body.evidenceVerified).toBe(true);expect(body.reason).toBe('Synthetic explicit evidence review');approved=true;writes++;json=clinic();}
  else throw new Error('Unexpected Platform fixture route: '+url);
  await route.fulfill({json});
 });
 await page.setViewportSize({width:375,height:812});await page.goto('/platform');await page.getByLabel('Email',{exact:true}).fill('synthetic@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Đăng nhập'}).click();await page.getByRole('button',{name:'Mở hồ sơ Synthetic submitted clinic'}).click();await expect(page.getByRole('heading',{name:'Kiểm duyệt Synthetic submitted clinic'})).toBeVisible();await page.getByLabel('Lý do quyết định').fill('Synthetic explicit evidence review');await expect(page.getByRole('button',{name:'Duyệt hồ sơ'})).toBeDisabled();await page.getByLabel('Đã xác minh minh chứng riêng và hiệu lực giấy phép').check();await page.getByRole('button',{name:'Duyệt hồ sơ'}).click();await expect(page.getByText('Quyết định đã được ghi nhận tại nguồn.')).toBeVisible();expect(writes).toBe(1);await expect(page.getByRole('button',{name:'Công bố hồ sơ đã duyệt'})).toBeDisabled();await expect(page.getByText('Hồ sơ: Đã duyệt · Công bố: UNPUBLISHED')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:path.resolve('../../../docs/audits/clinic-v2/P05-S0-06/configuration-verification/platform-review-mobile.png'),fullPage:true});await page.getByRole('button',{name:'Đăng xuất'}).click();await expect(page.getByText('private/synthetic-evidence')).toHaveCount(0);expect(await page.evaluate(()=>JSON.stringify([localStorage,sessionStorage]))).not.toContain('synthetic-platform-token');
});

