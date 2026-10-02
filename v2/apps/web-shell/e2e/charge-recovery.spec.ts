import {test,expect} from '@playwright/test';
import path from 'node:path';
test('manager recovers a failed charge using the original request after lost response on mobile',async({page})=>{
 let recovered=false;const writes:{key:string|undefined;body:unknown}[]=[];
 await page.route('**/s1/**',async route=>{
  const request=route.request(),url=request.url();let json:unknown={};
  if(url.endsWith('/auth/login'))json={data:{accessToken:'synthetic-manager'}};
  else if(url.endsWith('/me/current'))json={userId:'manager'};
  else if(url.endsWith('/me/contexts'))json=[{clinicId:'clinic',role:'RECEPTIONIST',branchIds:['branch']},{clinicId:'clinic',role:'CLINIC_MANAGER',allBranches:true,branchIds:[]}];
  else if(url.endsWith('/billing-directory'))json={id:'clinic',name:'Synthetic clinic',branches:[{id:'branch',name:'Synthetic location',active:true}]};
  else if(url.endsWith('/billable-visits'))json=[{id:'visit',patientId:'patient',appointmentId:null,status:'CLOSED',medicalCaseVersion:7,visitCode:'SYN-VISIT'}];
  else if(url.endsWith('/bills')||url.endsWith('/collection-shifts'))json=[];
  else if(url.endsWith('/source-charges'))json={chargeCount:1,events:[{eventId:'event',kind:'MEDICAL_REVIEWED',status:recovered?'APPLIED':'DLQ',attempts:recovered?0:8,lastError:null}]};
  else if(url.endsWith('/billing-deliveries')){if(url.includes('/medical/')){await route.fulfill({status:503,json:{error:{message:'Synthetic source unavailable'}}});return;}json={events:[{eventId:'completed',status:'PUBLISHED',attempts:0,lastError:null}]};}
  else if(url.endsWith('/source-charges/event/retry')){writes.push({key:request.headers()['idempotency-key'],body:request.postDataJSON()});if(writes.length===1){await route.fulfill({status:503,json:{error:{message:'Synthetic lost response'}}});return;}recovered=true;json={chargeCount:1,events:[{eventId:'event',status:'PENDING',attempts:0,lastError:null}]};}
  else throw new Error('Unexpected charge recovery fixture '+url);
  await route.fulfill({json});
 });
 await page.goto('/workspace?view=billing');await page.getByLabel('Email',{exact:true}).fill('manager@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.getByLabel('Địa điểm thu phí').selectOption('branch');await page.getByLabel('Lượt khám đã hoàn tất').selectOption('visit');await page.getByRole('button',{name:'Kiểm tra nguồn khoản phí'}).click();await expect(page.getByText(/Chưa kiểm tra được: Dịch vụ cận lâm sàng/)).toBeVisible();const retry=page.getByRole('button',{name:'Yêu cầu xử lý lại ghi nhận khoản phí'});await expect(retry).toBeDisabled();await page.getByLabel('Lý do lập phiếu hoặc xử lý').fill('Synthetic investigated source failure');await retry.click();await expect(page.getByLabel('Lý do lập phiếu hoặc xử lý')).toBeDisabled();await page.getByRole('button',{name:'Thử lại thu phí đang chờ'}).click();await expect(page.getByRole('button',{name:'Thử lại thu phí đang chờ'})).toHaveCount(0);expect(writes).toHaveLength(2);expect(writes[0]).toEqual(writes[1]);await page.getByRole('button',{name:'Kiểm tra nguồn khoản phí'}).click();await expect(page.getByText(/Đã ghi nhận · Đã thử 0 lần/)).toBeVisible();await expect(retry).toHaveCount(0);await expect(page.getByText('Khoản phí đã ghi nhận: 1')).toBeVisible();
 await page.setViewportSize({width:375,height:812});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.getByRole('heading',{name:'Đồng bộ khoản phí'}).scrollIntoViewIfNeeded();await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();});await page.screenshot({path:path.resolve('../../../docs/audits/clinic-v2/P05-S4/charge-recovery-mobile.png'),fullPage:true});expect(await page.evaluate(()=>JSON.stringify([sessionStorage,localStorage]))).not.toContain('synthetic-manager');
});
