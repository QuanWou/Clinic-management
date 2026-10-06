import { test,expect } from '@playwright/test';
import path from 'node:path';
test('owner edits source price with immutable history and recovers a lost response across reload on desktop/mobile',async({page})=>{
 let priceWrites=0;const clinic={id:'clinic',ownerUserId:'owner',name:'Synthetic configured clinic',slug:'synthetic-configured',reviewStatus:'DRAFT',publicationStatus:'UNPUBLISHED',evidenceVerified:false,version:3,contactName:'',contactEmail:'',contactPhone:'',license:null,branches:[{id:'branch',name:'Synthetic local point',address:'Synthetic address',openingHours:'08-17',active:true}]};const offering={id:'offering',code:'SYN',name:'Synthetic source offering',description:null,specialtyCode:null,active:true,version:4};
 await page.route('**/s1/**',async route=>{const url=route.request().url();let json:unknown={};
  if(url.endsWith('/auth/login'))json={data:{accessToken:'synthetic-owner-token'}};
  else if(url.endsWith('/me/current'))json={userId:'owner',legacyRoles:['ROLE_USER'],platformOperator:false};
  else if(url.endsWith('/me/contexts'))json=[{membershipId:'m',clinicId:'clinic',role:'ADMIN',allBranches:true,branchIds:[],version:1}];
  else if(url.endsWith('/clinics/mine'))json=[clinic];
  else if(url.endsWith('/clinics/clinic'))json=clinic;
  else if(url.endsWith('/branches/branch/offerings'))json=[{id:'assignment',offering,durationMinutes:30,active:true,publicVisible:false,version:2}];
  else if(url.endsWith('/clinics/clinic/offerings'))json=[offering];
  else if(url.endsWith('/price-versions')&&route.request().method()==='POST'){priceWrites++;await route.fulfill({status:503,json:{error:{message:'Synthetic response lost after dispatch'}}});return;}
  else if(url.endsWith('/price-versions'))json=[{id:'old-price',amountVnd:100000,currency:'VND',effectiveFrom:'2026-10-01T00:00:00Z',taxPolicyCode:null,discountPolicyCode:null}];
  else throw new Error('Unexpected configuration fixture route: '+url);
  await route.fulfill({json});
 });
 async function login(paused=false){await page.getByLabel('Email',{exact:true}).fill('synthetic@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Đăng nhập'}).click();if(paused){await expect(page.getByLabel('Dịch vụ cấu hình')).toBeVisible();return;}await page.getByLabel('Dịch vụ cấu hình').selectOption('offering');await expect(page.getByRole('heading',{name:'Phiên bản giá'})).toBeVisible();}
 const evidence=path.resolve('../../../docs/audits/clinic-v2/P05-S0-06/configuration-verification');
 await page.setViewportSize({width:1440,height:1000});await page.goto('/workspace?view=catalog');await login();await expect(page.getByText(/100.000/)).toBeVisible();await page.getByLabel('Giá mới (VND)').fill('120000');await page.getByLabel('Giá có hiệu lực từ').fill('2026-10-03T08:00');await page.screenshot({path:path.join(evidence,'configuration-desktop.png'),fullPage:true});
 await page.setViewportSize({width:375,height:812});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:path.join(evidence,'configuration-mobile.png'),fullPage:true});await page.getByRole('button',{name:'Thêm phiên bản giá'}).click();await expect(page.getByText(/Chưa xác định được kết quả lưu/)).toBeVisible();expect(priceWrites).toBe(1);
 await page.reload();await login(true);await expect(page.getByLabel('Dịch vụ cấu hình')).toBeDisabled();await page.getByRole('button',{name:'Tải lại dữ liệu cấu hình'}).click();await page.getByRole('button',{name:'Đã đối chiếu dữ liệu nguồn'}).click();await page.getByLabel('Dịch vụ cấu hình').selectOption('offering');await expect(page.getByRole('button',{name:'Thêm phiên bản giá'})).toBeEnabled();expect(priceWrites).toBe(1);expect(await page.evaluate(()=>JSON.stringify([localStorage,sessionStorage]))).not.toContain('synthetic-owner-token');
});

