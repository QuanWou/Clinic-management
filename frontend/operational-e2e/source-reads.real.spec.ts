import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const config=JSON.parse(fs.readFileSync(process.env.CLINIC_REAL_E2E_CONFIG!,'utf8'));
const pageErrors=new WeakMap<Page,string[]>();test.beforeEach(async({page})=>{const errors:string[]=[];pageErrors.set(page,errors);page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.url().includes('/s1/')&&response.status()>=400)errors.push(response.status()+' '+new URL(response.url()).pathname);});});
async function capture(page:Page,name:string){
 expect(pageErrors.get(page)).toEqual([]);await expect(page.getByRole('alert')).toHaveCount(0);
 for(const size of [{width:1280,height:800},{width:1366,height:768},{width:1440,height:900}]){
  await page.setViewportSize(size);await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
  if(name==='doctor-read'){
   const q=await page.locator('.doctor-queue').boundingBox(),d=await page.locator('.doctor-case').boundingBox();expect(q&&d&&q.x+q.width<=d.x).toBeTruthy();
  }
  if(size.width===1366)await page.screenshot({path:path.join(config.evidence,`actual-${name}-laptop-1366.png`),fullPage:true});
 }
 await page.setViewportSize({width:375,height:812});await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);await page.screenshot({path:path.join(config.evidence,`actual-${name}-mobile.png`),fullPage:true});expect(await page.evaluate(()=>JSON.stringify([localStorage,sessionStorage]))).not.toContain('accessToken');
 fs.writeFileSync(path.join(config.evidence,`actual-${name}.json`),JSON.stringify({status:'PASS',http:'actual-source-APIs-no-route-interception',action:'READ_EXISTING_OPERATIONAL_SOURCE',mobileWidth:375,laptopSizes:['1280x800','1366x768','1440x900'],credentialStorage:false},null,2));
}
test('patient reads paid onsite receipts and fulfilled history when clinic is unpublished',async({page})=>{
 await page.goto('/public');await page.getByLabel('Email',{exact:true}).fill(config.accounts.reception.email);await page.getByLabel('Mật khẩu',{exact:true}).fill(config.accounts.reception.password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.getByRole('button',{name:'Tải phòng khám có hồ sơ của tôi'}).click();await page.getByLabel('Phòng khám trong lịch sử').selectOption(config.clinic);await expect(page.getByText('Đã hoàn tất lượt khám',{exact:false})).toBeVisible();await page.getByLabel('Chi nhánh trong lịch sử').selectOption(config.branch);await page.getByRole('button',{name:'Tải khoản phải thu của tôi'}).click();await expect(page.getByText('Đã thanh toán',{exact:true})).toHaveCount(2);await page.getByText(/RCT-/).first().click();await expect(page.getByText('BIÊN NHẬN NỘI BỘ — KHÔNG PHẢI HÓA ĐƠN THUẾ').first()).toBeVisible();await capture(page,'patient-history');
});
test('cashier reads actual paid bills and internal receipts without collecting again',async({page})=>{
 await page.goto(`/workspace?view=billing&clinicId=${config.clinic}`);await page.getByLabel('Email thu ngân').fill(config.accounts.stranger.email);await page.getByLabel('Mật khẩu thu ngân').fill(config.accounts.stranger.password);await page.getByRole('button',{name:'Đăng nhập thu phí',exact:true}).click();await page.getByLabel('Địa điểm thu phí').selectOption(config.branch);await expect(page.getByLabel('Phiếu thu').locator('option')).toHaveCount(3);const bill=await page.getByLabel('Phiếu thu').locator('option').nth(1).getAttribute('value');await page.getByLabel('Phiếu thu').selectOption(bill!);await expect(page.getByRole('heading',{name:'Khoản phải thu'})).toBeVisible();await expect(page.getByRole('button',{name:'Ghi nhận tiền đã nhận',exact:true})).toBeDisabled();await page.locator('[aria-label="Biên nhận đã ghi nhận"]').getByRole('button').first().click();await expect(page.getByRole('heading',{name:'BIÊN NHẬN NỘI BỘ — KHÔNG PHẢI HÓA ĐƠN THUẾ'})).toBeVisible();await capture(page,'cashier-read');
});
test('reception reads its actual receipts and paged queue',async({page})=>{
 await page.goto(`/workspace?view=reception&clinicId=${config.clinic}`);await page.getByLabel('Email nhân viên').fill(config.accounts.reception.email);await page.getByLabel('Mật khẩu nhân viên').fill(config.accounts.reception.password);await page.getByRole('button',{name:'Đăng nhập tiếp nhận'}).click();await page.getByLabel('Địa điểm tiếp nhận').selectOption(config.branch);await page.getByRole('combobox',{name:'Điểm phục vụ',exact:true}).selectOption(config.pointId);await page.getByRole('button',{name:'Tải lại hàng đợi'}).click();await expect(page.getByRole('heading',{name:'Hàng đợi tại điểm phục vụ',exact:true}).locator('..').getByRole('heading',{name:config.queueCode,exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Tra cứu lượt đã gửi'})).toBeVisible();await capture(page,'reception-read');
});
test('assigned doctor reads current visit and draft from actual Encounter and Medical',async({page})=>{
 await page.goto(`/workspace?view=doctor&clinicId=${config.clinic}`);await page.getByLabel('Email bác sĩ').fill(config.accounts.doctor.email);await page.getByLabel('Mật khẩu bác sĩ').fill(config.accounts.doctor.password);await page.getByRole('button',{name:'Đăng nhập bác sĩ'}).click();await page.getByLabel('Địa điểm khám').selectOption(config.branch);await page.locator('[aria-label="Lượt khám được phân công"]').getByRole('button').first().click();await expect(page.getByRole('heading',{name:'Lượt đang chọn'})).toBeVisible();await expect(page.getByLabel('Lý do khám',{exact:true})).toBeVisible();await capture(page,'doctor-read');
});
test('owner reads actual Encounter and Billing aggregates for a single clinic',async({page})=>{
 await page.goto(`/workspace?clinicId=${config.clinic}`);await page.getByLabel('Email tổng quan').fill(config.accounts.owner.email);await page.getByLabel('Mật khẩu tổng quan').fill(config.accounts.owner.password);await page.getByRole('button',{name:'Đăng nhập tổng quan'}).click();await page.getByLabel('Địa điểm báo cáo').selectOption(config.branch);await page.getByRole('button',{name:'Tải tổng quan nguồn'}).click();await expect(page.getByRole('heading',{name:'Toàn phạm vi đang chọn'})).toBeVisible();await expect(page.getByText(/Khoản còn phải thu hiện tại/)).toContainText('0');await capture(page,'owner-read');
});


