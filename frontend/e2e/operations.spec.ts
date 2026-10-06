import { test,expect } from '@playwright/test';
import path from 'node:path';
test('owner overview shows scoped operational sources, withholds failed aggregates and clears on revoke on desktop/mobile',async({page})=>{
 let missing=false,revoked=false;
 await page.route('**/s1/**',async route=>{
  const url=route.request().url();let json:unknown={};
  if(url.endsWith('/auth/login'))json={data:{accessToken:'synthetic-owner-token'}};
  else if(url.endsWith('/me/current'))json={userId:'fixture-user',legacyRoles:['ROLE_USER'],platformOperator:false};
  else if(url.endsWith('/me/contexts'))json=[{membershipId:'m',clinicId:'clinic',role:'ADMIN',allBranches:true,branchIds:[],version:1}];
  else if(url.endsWith('/reception-directory')){if(revoked){await route.fulfill({status:403,json:{error:{message:'Synthetic owner access revoked'}}});return;}json={id:'clinic',name:'Synthetic real-source fixture clinic',branches:[{id:'branch',name:'Synthetic main location',active:true}]};}
  else if(url.includes('/operations-summary?')&&url.includes('/encounter/'))json={date:'2026-10-02',measuredAt:'2026-10-01T17:30:00Z',checkedIn:2,completed:1,openVisits:1,overnight:1,awaitingResults:1,arrivalPending:0,waitingTickets:0,servingTickets:0};
  else if(url.includes('/operations-summary?')){if(missing){await route.fulfill({status:503,json:{error:{message:'Synthetic source unavailable'}}});return;}json={date:'2026-10-02',measuredAt:'2026-10-01T17:30:00Z',issuedVnd:100000,collectedCashVnd:40000,collectedBankVnd:0,collectedPosVnd:0,receiptCount:1,outstandingVnd:60000,openShifts:1,submittedShifts:1,approvedShifts:0};}
  await route.fulfill({json});
 });
 await page.setViewportSize({width:1440,height:1000});await page.goto('/workspace');await page.getByLabel('Email',{exact:true}).fill('synthetic@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Đăng nhập'}).click();await page.getByRole('button',{name:'Tải tổng quan nguồn'}).click();await expect(page.getByText('Toàn phạm vi đang chọn')).toBeVisible();await expect(page.getByText(/Khoản còn phải thu hiện tại/)).toContainText('60.000');
 const evidence=path.resolve('../../../docs/audits/clinic-v2/P05-S5/aftercare-verification');await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();});await page.screenshot({path:path.join(evidence,'operations-desktop.png'),fullPage:true});
 await page.setViewportSize({width:375,height:812});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:path.join(evidence,'operations-mobile.png'),fullPage:true});
 missing=true;await page.getByRole('button',{name:'Tải tổng quan nguồn'}).click();await expect(page.getByText('Nguồn thu phí chưa tải được.')).toBeVisible();await expect(page.getByText('Toàn phạm vi đang chọn')).toHaveCount(0);missing=false;await page.getByRole('button',{name:'Tải tổng quan nguồn'}).click();await expect(page.getByText('Toàn phạm vi đang chọn')).toBeVisible();
 revoked=true;await page.getByRole('button',{name:'Tải tổng quan nguồn'}).click();await expect(page.getByText('Synthetic owner access revoked')).toBeVisible();await expect(page.getByText('Toàn phạm vi đang chọn')).toHaveCount(0);expect(await page.evaluate(()=>JSON.stringify([localStorage,sessionStorage]))).not.toContain('synthetic-owner-token');
});
