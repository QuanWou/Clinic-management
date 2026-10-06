import {test,expect} from '@playwright/test';
import path from 'node:path';
const evidence=path.resolve('../../../docs/audits/clinic-v2/P05-S2');
test('manager source cancellation freezes its original request after a lost reply on mobile',async({page})=>{
 const source={id:'absence',doctorId:'doctor',startsAt:'2026-10-02T03:00:00Z',endsAt:'2026-10-02T04:00:00Z',state:'ACTIVE',version:1};const requests:{body:unknown;key:string|undefined}[]=[];
 await page.route('**/s1/**',async route=>{const req=route.request(),url=req.url();let json:unknown=[];
  if(url.endsWith('/auth/login'))json={data:{accessToken:'synthetic-token'}};
  else if(url.endsWith('/me/current'))json={userId:'fixture-user',legacyRoles:['ROLE_USER'],platformOperator:false};
  else if(url.endsWith('/me/contexts'))json=[{membershipId:'first',clinicId:'clinic',role:'STAFF',allBranches:false,branchIds:['branch'],version:1},{membershipId:'manager',clinicId:'clinic',role:'ADMIN',allBranches:false,branchIds:['branch'],version:1}];
  else if(url.endsWith('/reception-directory'))json={id:'clinic',name:'Synthetic Clinic',branches:[{id:'branch',name:'Synthetic Branch',active:true}]};
  else if(url.endsWith('/doctor-affiliations'))json=[{practitionerId:'doctor',displayName:'Synthetic Doctor',active:true,effectiveFrom:'2020-01-01',effectiveUntil:null}];
  else if(url.endsWith('/absences'))json=[source];
  else if(url.endsWith('/absence/cancel')){requests.push({body:req.postDataJSON(),key:req.headers()['idempotency-key']});if(requests.length===1){await route.abort('failed');return;}json={previous:{...source,state:'CANCELLED',version:2},replacement:null};}
  await route.fulfill({json});
 });
 await page.setViewportSize({width:375,height:812});await page.goto('/workspace?view=reception');await page.getByLabel('Email',{exact:true}).fill('synthetic@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Đăng nhập'}).click();await page.getByLabel('Địa điểm tiếp nhận').selectOption('branch');await page.getByRole('combobox',{name:'Bác sĩ tiếp nhận',exact:true}).selectOption('doctor');await page.getByRole('button',{name:'Tải nguồn khoảng vắng để xử lý'}).click();await expect(page.getByRole('button',{name:'Hủy khoảng vắng này'})).toBeVisible();await page.getByLabel('Lý do xử lý khoảng vắng hoặc ngoại lệ').fill('Synthetic source investigation');await page.getByRole('button',{name:'Hủy khoảng vắng này'}).click();await expect(page.getByRole('button',{name:'Thử lại yêu cầu xử lý đang chờ'})).toBeVisible();await expect(page.getByLabel('Địa điểm tiếp nhận')).toBeDisabled();await expect(page.getByRole('combobox',{name:'Bác sĩ tiếp nhận',exact:true})).toBeDisabled();await expect(page.getByLabel('Lý do xử lý khoảng vắng hoặc ngoại lệ')).toBeDisabled();await page.getByRole('button',{name:'Thử lại yêu cầu xử lý đang chờ'}).click();await expect(page.getByRole('status').filter({hasText:'Hủy khoảng vắng đã được ghi nhận'})).toBeVisible();expect(requests).toHaveLength(2);expect(requests[0]).toEqual(requests[1]);expect(requests[0].key).toBeTruthy();expect(requests[0].body).toEqual({expectedVersion:1,reason:'Synthetic source investigation'});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);await page.locator('[aria-label="Xử lý nguồn vắng và ngoại lệ"]').screenshot({path:path.join(evidence,'absence-lifecycle-mobile.png')});
});

