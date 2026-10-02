import { test,expect } from '@playwright/test';
test('proposed follow-up starts a new no-deposit booking linked to the prior visit and retries the same hold request',async({page})=>{
 const price={amountVnd:120000,currency:'VND',priceVersionId:'current-price',effectiveFrom:'2026-01-01T00:00:00Z'};
 const clinic={clinicId:'clinic-a',name:'Synthetic Clinic',branches:[{branchId:'branch-a',name:'Synthetic Branch',address:'Synthetic address',openingHours:'08-17'}]};let holds=0;const bodies:unknown[]=[];const keys:string[]=[];
 await page.route('**/s1/**',async route=>{const url=route.request().url();let json:unknown={};
  if(url.endsWith('/auth/login'))json={data:{accessToken:'synthetic-patient-token'}};
  else if(url.endsWith('/me/current'))json={userId:'fixture-user',legacyRoles:['ROLE_USER'],platformOperator:false};
  else if(url.endsWith('/me/contexts'))json=[];
  else if(url.endsWith('/patient-profile'))json={patientId:'patient-a',fullName:'Synthetic Patient',dateOfBirth:'1990-01-01',sex:'',phone:'',email:'',version:0};
  else if(url.endsWith('/me/patient-clinics'))json=[{clinicId:'clinic-a',name:'Synthetic Clinic',branches:[{branchId:'branch-a',name:'Synthetic Branch',active:true}]}];
  else if(url.includes('/me/appointments?'))json=[{id:'old-appointment',appointmentCode:'AP-OLD',status:'FULFILLED',startsAt:'2026-10-01T01:00:00Z',price}];
  else if(url.endsWith('/follow-up-plans'))json=[{encounterId:'old-visit',clinicId:'clinic-a',branchId:'branch-a',caseVersion:7,proposedDate:'2026-12-01'}];
  else if(url.includes('/public/clinics?page='))json={content:[{id:clinic.clinicId,name:clinic.name,publicDescription:'Synthetic description',branches:clinic.branches.map(b=>({...b,id:b.branchId,active:true}))}],totalElements:1};
  else if(url.endsWith('/public/clinics/by-id/clinic-a'))json={id:clinic.clinicId,name:clinic.name,publicDescription:'Synthetic description',branches:clinic.branches.map(b=>({...b,id:b.branchId,active:true}))};
  else if(url.includes('/doctors?'))json=[{doctorId:'doctor-a',displayName:'Synthetic Doctor'}];
  else if(url.includes('/offerings?'))json=[{offeringId:'offering-a',name:'Synthetic consultation',amountVnd:120000}];
  else if(url.includes('/availability?'))json=[{slotId:'new-slot',startsAt:'2026-12-01T01:00:00Z',endsAt:'2026-12-01T01:30:00Z',remaining:1,price}];
  else if(url.endsWith('/appointments/follow-up-holds')){bodies.push(route.request().postDataJSON());keys.push(route.request().headers()['idempotency-key']);if(++holds===1){await route.fulfill({status:503,json:{error:{message:'Synthetic unknown hold outcome'}}});return;}json={holdId:'new-hold',state:'ACTIVE',expiresAt:new Date(Date.now()+600000).toISOString(),price};}
  else if(url.endsWith('/appointments'))json={id:'new-appointment',appointmentCode:'AP-NEW-FOLLOWUP',clinicId:'clinic-a',status:'CONFIRMED',startsAt:'2026-12-01T01:00:00Z',endsAt:'2026-12-01T01:30:00Z',price,priorEncounterId:'old-visit'};
  await route.fulfill({json});
 });
 await page.goto('/public/account');await page.getByRole('button',{name:'Đăng nhập tài khoản',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill('synthetic@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
 await page.getByRole('button',{name:'Tải phòng khám có hồ sơ của tôi'}).click();await page.getByLabel('Phòng khám trong lịch sử').selectOption('clinic-a');await page.getByLabel('Chi nhánh trong lịch sử').selectOption('branch-a');await page.getByRole('button',{name:'Tải lịch tái khám đề xuất'}).click();await page.getByRole('button',{name:'Chọn giờ tái khám'}).click();
 await expect(page.getByRole('combobox',{name:'Địa điểm khám',exact:true})).toHaveCount(0);await page.getByRole('combobox',{name:'Bác sĩ',exact:true}).selectOption('doctor-a');await page.getByRole('combobox',{name:'Dịch vụ',exact:true}).selectOption('offering-a');expect(await page.getByLabel('Ngày khám').inputValue()).toBe('2026-12-01');await page.getByRole('button',{name:'Xem giờ còn trống'}).click();
 await page.getByRole('button',{name:/120.000/}).click();await expect(page.getByText('Synthetic unknown hold outcome')).toBeVisible();await page.getByRole('button',{name:/120.000/}).click();await page.getByRole('button',{name:'Xác nhận đặt lịch'}).click();await expect(page.getByRole('status').filter({hasText:'Đã xác nhận: AP-NEW-FOLLOWUP'})).toBeVisible();
 expect(bodies).toHaveLength(2);expect(bodies[0]).toEqual(bodies[1]);expect(bodies[0]).toMatchObject({priorEncounterId:'old-visit',priorBranchId:'branch-a',patientId:'patient-a',slotId:'new-slot'});expect(keys[0]).toBeTruthy();expect(keys[1]).toBe(keys[0]);await page.getByRole('link',{name:'Tài khoản bệnh nhân',exact:true}).click();await expect(page.getByRole('heading',{name:'AP-OLD',exact:true})).toBeVisible();
});
