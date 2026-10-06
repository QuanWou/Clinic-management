import { test,expect } from '@playwright/test';
import path from 'node:path';
const evidence=path.resolve('../../../docs/audits/clinic-v2/P05-S3/verification');
test('assigned doctor waits and returns through reception queue on desktop and mobile',async({page})=>{
 const commands:{id:string;action:string;body:unknown;key?:string}[]=[];
 const ticket={id:'ticket',visitId:'visit',servicePointId:'point',date:'2026-10-01',number:1,code:'R1-20261001-0001',state:'CALLED',version:1};
 let visit={id:'visit',appointmentId:null,status:'WAITING',version:1,ticket:ticket as typeof ticket|null};
 await page.route('**/s1/**',async route=>{
  const req=route.request(),url=req.url(),body=req.postDataJSON();let json:unknown={};
  if(url.endsWith('/auth/login'))json={data:{accessToken:'synthetic-doctor-token'}};
  else if(url.endsWith('/me/current'))json={userId:'fixture-user',legacyRoles:['ROLE_USER'],platformOperator:false};
  else if(url.endsWith('/me/contexts'))json=[{membershipId:'m',clinicId:'clinic',role:'DOCTOR',allBranches:false,branchIds:['branch'],version:1}];
  else if(url.endsWith('/care-directory'))json={id:'clinic',name:'Synthetic Clinic',branches:[{id:'branch',name:'Synthetic Branch',active:true}]};
  else if(url.endsWith('/doctor/service-points'))json=[{id:'point',code:'R1',name:'Synthetic Room',active:true}];
  else if(url.endsWith('/doctor/worklist'))json=[visit];
  else if(url.endsWith('/visits/visit/draft'))json={encounterId:'visit',documentVersion:0,caseVersion:0,status:'DRAFT',content:null};
  else if(url.endsWith('/visits/visit/orders')||url.endsWith('/offerings'))json=[];
  else if(url.includes('/doctor/visits/visit/')){
   const action=url.split('/').at(-1)!;commands.push({id:visit.id,action,body,key:req.headers()['idempotency-key']});expect(body.expectedVersion).toBe(visit.version);
   if(action==='start')visit={...visit,status:'IN_PROGRESS',version:visit.version+1,ticket:{...ticket,state:'SERVING'}};
   else if(action==='await-results')visit={...visit,status:'AWAITING_RESULTS',version:visit.version+1,ticket:null};
   else if(action==='resume-queue'){expect(body.servicePointId).toBe('point');visit={...visit,version:visit.version+1,ticket:{...ticket,id:'return-ticket',number:2,code:'R1-20261001-0002',state:'WAITING'}};}
   json=visit;
  }else throw new Error('Unexpected doctor request '+url);
  await route.fulfill({json});
 });
 await page.goto('/workspace?view=doctor');await page.getByLabel('Email',{exact:true}).fill('doctor@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Đăng nhập'}).click();await page.getByLabel('Địa điểm khám').selectOption('branch');await page.getByRole('button',{name:'Chọn lượt R1-20261001-0001',exact:true}).click();
 await page.getByLabel('Lý do chuyển trạng thái khám').fill('Synthetic start');await page.getByRole('button',{name:'Bắt đầu hoặc tiếp tục khám'}).click();await expect(page.getByRole('status').filter({hasText:'Đã bắt đầu'})).toBeVisible();
 await page.getByLabel('Lý do chuyển trạng thái khám').fill('Synthetic wait');await page.getByRole('button',{name:'Chuyển sang chờ kết quả'}).click();await expect(page.getByRole('status').filter({hasText:'nhường điểm phục vụ'})).toBeVisible();
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await page.screenshot({path:path.join(evidence,'doctor-desktop.png'),fullPage:true});
 for(const width of [320,375,768,1024]){await page.setViewportSize({width,height:812});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}
 await page.setViewportSize({width:375,height:812});await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await page.screenshot({path:path.join(evidence,'doctor-mobile.png'),fullPage:true});
 await page.reload();await page.getByLabel('Email',{exact:true}).fill('doctor@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Đăng nhập'}).click();await page.getByLabel('Địa điểm khám').selectOption('branch');await page.getByRole('button',{name:'Chọn lượt visit',exact:true}).click();
 await page.getByLabel('Lý do chuyển trạng thái khám').fill('Synthetic return');await page.getByLabel('Điểm phục vụ khi quay lại').selectOption('point');await page.getByRole('button',{name:'Đưa lại vào hàng đợi'}).click();await expect(page.getByRole('status').filter({hasText:'Chờ tiếp nhận gọi lượt'})).toBeVisible();await expect(page.getByRole('button',{name:'Bắt đầu hoặc tiếp tục khám'})).toHaveCount(0);
 // Reception has called this returning ticket; a fresh server read enables care.
 visit={...visit,version:visit.version+1,ticket:{...visit.ticket!,state:'CALLED',version:2}};
 await page.getByRole('button',{name:'Tải lại danh sách khám'}).click();await page.getByLabel('Lý do chuyển trạng thái khám').fill('Synthetic resume');await page.getByRole('button',{name:'Bắt đầu hoặc tiếp tục khám'}).click();await expect(page.getByRole('status').filter({hasText:'Đã bắt đầu'})).toBeVisible();
 expect(commands.map(c=>c.action)).toEqual(['start','await-results','resume-queue','start']);expect(commands.every(c=>c.id==='visit'&&!!c.key)).toBe(true);
});
