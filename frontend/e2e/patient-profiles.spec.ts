import {test,expect} from '@playwright/test';
import path from 'node:path';

test('admin manages walk-in profiles on desktop and mobile',async({page})=>{
 let profile={patientId:'profile',patientCode:'PT-001',fullName:'Nguyễn An',dateOfBirth:null,sex:null,phone:'0901234567',email:null,status:'PROVISIONAL',hasAccount:false,createdAt:'2026-10-01T08:00:00Z',updatedAt:'2026-10-01T08:00:00Z',version:2};
 let writes=0;const clinic={id:'clinic',ownerUserId:'admin',name:'Phòng khám kiểm thử',slug:'clinic',reviewStatus:'APPROVED',publicationStatus:'PUBLISHED',evidenceVerified:true,version:1,branches:[{id:'branch',name:'Cơ sở',active:true,address:'Địa chỉ kiểm thử',openingHours:'08-17'}]};
 await page.route('**/s1/**',async route=>{
  const req=route.request(),url=new URL(req.url());let json:unknown=[];
  if(url.pathname.endsWith('/auth/refresh')){await route.fulfill({status:401,json:{}});return;}
  if(url.pathname.endsWith('/auth/login'))json={data:{accessToken:'fixture-token',email:'admin@example.invalid'}};
  else if(url.pathname.endsWith('/me/current'))json={userId:'admin',legacyRoles:['ROLE_PATIENT'],platformOperator:false};
  else if(url.pathname.endsWith('/me/contexts'))json=[{membershipId:'m',clinicId:'clinic',role:'ADMIN',allBranches:true,branchIds:[],version:1}];
  else if(url.pathname.endsWith('/clinics/mine'))json=[clinic];
  else if(url.pathname.endsWith('/clinics/clinic'))json=clinic;
  else if(url.pathname.endsWith('/admin/patients/profile/visits'))json={content:[{encounterId:'visit',visitCode:'A-001',doctorId:'doctor',status:'CLINICALLY_COMPLETED',createdAt:'2026-10-01T08:00:00Z',checkedInAt:'2026-10-01T08:00:00Z',completedAt:'2026-10-01T09:00:00Z',serviceName:'Khám tổng quát',walkIn:true}],totalElements:1,totalPages:1,number:0,size:20};
  else if(url.pathname.endsWith('/visits/visit/medical-record'))json={encounterId:'visit',status:'VALIDATED',documentVersion:2,savedAt:'2026-10-01T09:00:00Z',authorUserId:'doctor-user',content:{reasonForVisit:'Đau đầu',medicalHistory:'Chưa ghi nhận bệnh nền',allergies:'Không ghi nhận',vitals:'Huyết áp 120/80 mmHg',examination:'Nội dung khám lâm sàng',preliminaryDiagnosis:'Chẩn đoán được lưu bởi bác sĩ',conclusion:'Kết luận lượt khám',instructions:'Hướng dẫn điều trị và theo dõi tại nhà',followUpDate:'2026-10-15'},orders:[{id:'order',name:'Công thức máu',state:'REVIEWED',orderedAt:'2026-10-01T08:15:00Z',result:'Kết quả xét nghiệm được bác sĩ xác nhận',resultAt:'2026-10-01T08:30:00Z',reviewedAt:'2026-10-01T08:45:00Z'}]};
  else if(url.pathname.endsWith('/doctor-affiliations'))json=[{practitionerId:'doctor',displayName:'Bác sĩ An'}];
  else if(url.pathname.includes('/patient-profiles')){
   if(req.method()==='PUT'){writes++;const body=req.postDataJSON();expect(body.expectedVersion).toBe(2);profile={...profile,phone:body.phone,version:3};json=profile;}
   else if(url.pathname.endsWith('/profile'))json={profile,changes:writes?[{id:'change',action:'UPDATE',changedFields:'phone',reason:'Bổ sung số liên hệ',actorUserId:'admin',createdAt:profile.updatedAt}]:[]};
   else json={content:[profile],totalElements:1,totalPages:1,number:0,size:20};
  }
  await route.fulfill({json});
 });
 await page.setViewportSize({width:1440,height:960});await page.goto('/workspace?view=patients&clinicId=clinic');
 await page.getByLabel('Email',{exact:true}).fill('admin@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('Fixture!123');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Hồ sơ bệnh nhân',exact:true})).toBeVisible();await expect(page.getByRole('cell',{name:'Chưa có tài khoản',exact:true})).toBeVisible();
 await page.screenshot({path:path.resolve('../.runtime/main/patient-profiles-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:path.resolve('../.runtime/main/patient-profiles-mobile.png'),fullPage:true});
 await page.getByRole('button',{name:'Quản lý hồ sơ Nguyễn An'}).click();await page.getByLabel('Số điện thoại').fill('0909999999');await page.getByLabel('Lý do tạo / cập nhật hồ sơ').fill('Bổ sung số liên hệ');await expect(page.getByRole('button',{name:'Về danh sách'})).toBeDisabled();
 await page.getByRole('button',{name:'Lưu hồ sơ bệnh nhân'}).click();await expect(page.getByText('Đã lưu thay đổi.')).toBeVisible();expect(writes).toBe(1);await expect(page.getByRole('table',{name:'Lịch sử thay đổi hồ sơ'})).toBeVisible();
 await page.screenshot({path:path.resolve('../.runtime/main/patient-profiles-detail-mobile.png'),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Bệnh án & lịch sử khám',exact:true}).click();await expect(page.getByRole('table',{name:'Lịch sử khám bệnh nhân'})).toBeVisible();await page.getByRole('button',{name:'Xem bệnh án A-001'}).click();await expect(page.getByText('Chẩn đoán được lưu bởi bác sĩ')).toBeVisible();await expect(page.getByText('Kết quả xét nghiệm được bác sĩ xác nhận')).toBeVisible();await expect(page.getByRole('heading',{name:'Bệnh án đã xác nhận'})).toBeVisible();
 await page.screenshot({path:path.resolve('../.runtime/main/patient-clinical-mobile.png'),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:path.resolve('../.runtime/main/patient-clinical-desktop.png'),fullPage:true});
});
