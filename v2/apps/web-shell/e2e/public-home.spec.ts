import {test,expect} from '@playwright/test';

test('clinic introduction uses published data, separates patient forms and preselects booking choices',async({page})=>{
 const requests:string[]=[];
 await page.route('**/s1/**',async route=>{
  const url=route.request().url();requests.push(url);
  let json:unknown;
  if(url.includes('/public/clinics?page='))json={content:[{id:'clinic-a',name:'Phòng khám An Nhiên',publicDescription:'Synthetic public description',branches:[{id:'branch-a',name:'Synthetic location',address:'Synthetic address',openingHours:'08:00–17:00',active:true}]}],totalElements:1};
  else if(url.includes('/clinics/clinic-a/doctors'))json=[{doctorId:'doctor-a',clinicId:'clinic-a',branchId:'branch-a',displayName:'Synthetic Doctor',specialtyName:'Synthetic specialty'}];
  else if(url.includes('/clinics/clinic-a/offerings'))json=[{offeringId:'offering-a',clinicId:'clinic-a',branchId:'branch-a',name:'Synthetic Offering',amountVnd:120000,priceVersionId:'price-a'}];
  else throw Error('Unexpected public home request '+url);
  await route.fulfill({json});
 });
 await page.goto('/public');
 await expect(page.getByRole('heading',{name:'Phòng khám An Nhiên',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Synthetic Offering',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Synthetic Doctor',exact:true})).toBeVisible();
 await expect(page.getByText('Synthetic address', {exact:true})).toBeVisible();
 await expect(page.getByRole('searchbox')).toHaveCount(0);
 await expect(page.getByRole('form')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Hồ sơ bệnh nhân',exact:true})).toHaveCount(0);
 await expect(page.getByRole('alert')).toHaveCount(0);
 for(const width of [1366,1024,375]){
  await page.setViewportSize({width,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await expect(page.getByRole('link',{name:'Đặt lịch khám',exact:true})).toBeVisible();
 }
 await page.setViewportSize({width:1366,height:768});
 await page.getByRole('button',{name:'Đặt lịch dịch vụ Synthetic Offering',exact:true}).click();
 await expect(page).toHaveURL(/\/public\/booking$/);
 await expect(page.getByRole('combobox',{name:'Dịch vụ',exact:true})).toHaveValue('offering-a');
 await expect(page.getByRole('combobox',{name:'Địa điểm khám',exact:true})).toHaveCount(0);
 await page.getByRole('link',{name:'Bác sĩ',exact:true}).click();
 await expect(page).toHaveURL(/\/public#doctors$/);
 await expect(page.getByRole('heading',{name:'Synthetic Doctor',exact:true})).toBeInViewport();
 await page.getByRole('button',{name:'Đặt lịch với Synthetic Doctor',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Bác sĩ',exact:true})).toHaveValue('doctor-a');
 await page.getByRole('link',{name:'Tài khoản bệnh nhân',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Tài khoản bệnh nhân',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Chọn lịch khám',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Đăng nhập tài khoản',exact:true}).click();
 await expect(page).toHaveURL(/\/login\?area=public&next=account$/);
 expect(requests.some(url=>url.includes('/public/search'))).toBe(false);
 expect(requests.every(url=>url.includes('/public/'))).toBe(true);
});

test('an ambiguous clinic source offers recovery without showing another clinic',async({page})=>{
 let valid=false;
 await page.route('**/s1/**',async route=>{
  const url=route.request().url();
  if(url.includes('/public/clinics?page='))await route.fulfill({json:{content:[{id:'clinic-a',name:'Synthetic single clinic',branches:[]}],totalElements:valid?1:2}});
  else if(url.includes('/doctors')||url.includes('/offerings'))await route.fulfill({json:[]});
  else throw Error('Unexpected source recovery request '+url);
 });
 await page.goto('/public');
 await expect(page.getByRole('alert')).toContainText('Trang đặt lịch hiện chưa sẵn sàng');
 await expect(page.getByRole('heading',{name:'Synthetic single clinic',exact:true})).toHaveCount(0);
 valid=true;await page.getByRole('button',{name:'Tải lại thông tin phòng khám',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Synthetic single clinic',exact:true})).toBeVisible();
 await expect(page.getByRole('alert')).toHaveCount(0);
});
