// Read-only live UI smoke check. No patient, appointment or money mutations.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtime=path.join(root,'.runtime/main');
const config=JSON.parse(fs.readFileSync(path.join(runtime,'config.json'),'utf8').replace(/^\uFEFF/,''));
const out=path.join(runtime,'front-desk-review');fs.mkdirSync(out,{recursive:true});
const require=createRequire(path.join(root,'frontend/package.json'));
const {chromium,expect}=require('@playwright/test');
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}});
const failures=[];page.on('pageerror',e=>failures.push(e.message));
let blocked=0,reads=0;
await page.route('**/api/**',async route=>{
 const req=route.request();
 if(req.method()!=='GET'&&!new URL(req.url()).pathname.endsWith('/auth/login')){blocked++;return route.abort();}
 if(req.url().includes('/reception/appointments'))reads++;
 return route.continue();
});
try{
 await page.goto('http://127.0.0.1:4176/workspace?view=reception');
 await page.getByLabel('Email',{exact:true}).fill(config.accounts.reception.email);
 await page.getByLabel('Mật khẩu',{exact:true}).fill(config.accounts.reception.password);
 await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Quầy tiếp nhận'})).toBeVisible();
 await expect(page.getByRole('table',{name:'Lịch hẹn trong ngày'})).toBeVisible();
 await page.screenshot({path:path.join(out,'01-appointments.png'),fullPage:true});
 await page.getByRole('button',{name:'Khách đến trực tiếp',exact:true}).click();
 await expect(page.getByRole('button',{name:'Chọn hồ sơ'}).first()).toBeEnabled();
 await page.getByRole('button',{name:'Chọn hồ sơ'}).first().click();
 await expect(page.getByRole('heading',{name:'Xác nhận tiếp nhận'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Tiếp nhận & cấp số'})).toBeDisabled();
 await page.screenshot({path:path.join(out,'02-walk-in.png'),fullPage:true});
 for(const width of [320,768,1024,1440]){
  await page.setViewportSize({width,height:960});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Overflow at '+width);
  await page.screenshot({path:path.join(out,`walk-in-${width}.png`),fullPage:true});
 }
 await page.getByRole('button',{name:'Hàng đợi',exact:true}).click();
 await expect(page.getByRole('table',{name:'Danh sách hàng đợi'})).toBeVisible();
 const before=reads;await expect.poll(()=>reads,{timeout:22000}).toBeGreaterThan(before);
 await page.screenshot({path:path.join(out,'03-queue.png'),fullPage:true});
 await page.getByRole('button',{name:'Thu phí & ca thu',exact:true}).click();
 await expect(page.getByRole('table',{name:'Danh sách phiếu thu'})).toBeVisible();
 await page.screenshot({path:path.join(out,'04-cashier.png'),fullPage:true});
 await page.getByRole('button',{name:'Ca làm việc & đối chiếu'}).click();
 await expect(page.getByRole('heading',{name:'Quản lý ca thu'})).toBeVisible();
 assert.equal(blocked,0,'UI attempted an unexpected write');assert.deepEqual(failures,[]);
 console.log(JSON.stringify({status:'PASS',responsiveWidths:[320,768,1024,1440],autoRefresh:true,blockedWrites:blocked,screenshots:out}));
}finally{await browser.close();}
