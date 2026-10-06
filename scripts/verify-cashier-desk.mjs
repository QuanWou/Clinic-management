// Read-only live UI inspection; payment/shift mutations are blocked.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtime=path.join(root,'.runtime/main');
const cfg=JSON.parse(fs.readFileSync(path.join(runtime,'config.json'),'utf8').replace(/^\uFEFF/,''));
const out=path.join(runtime,'cashier-desk-review');fs.mkdirSync(out,{recursive:true});
const require=createRequire(path.join(root,'frontend/package.json'));
const {chromium,expect}=require('@playwright/test');
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'vi-VN'});
let blocked=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',route=>{const r=route.request();if(r.method()!=='GET'&&!new URL(r.url()).pathname.endsWith('/auth/login')){blocked++;return route.abort();}return route.continue();});
try{
 await page.goto('http://127.0.0.1:4176/workspace?view=billing');
 await page.getByLabel('Email',{exact:true}).fill(cfg.accounts.reception.email);await page.getByLabel('Mật khẩu',{exact:true}).fill(cfg.accounts.reception.password);
 await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
 await expect(page.getByRole('table',{name:'Danh sách phiếu thu'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Chi tiết phiếu thu',exact:true})).toBeHidden();
 await page.screenshot({path:path.join(out,'01-list.png'),fullPage:true});
 await page.getByRole('button',{name:/^Chọn phiếu/}).first().click();
 await expect(page.getByRole('heading',{name:'Chi tiết phiếu thu',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Điền đủ số dư'}).click();
 const amount=Number(await page.getByLabel('Số tiền VND',{exact:true}).inputValue());assert.ok(amount>0);
 await page.getByLabel('Tiền khách đưa (tùy chọn)',{exact:true}).fill(String(amount+100000));
 await expect(page.getByText(/Tiền trả lại: 100.000/)).toBeVisible();
 await page.getByLabel('Lý do lập phiếu hoặc xử lý').fill('Xem trước giao diện, không ghi nhận tiền');
 await page.getByRole('button',{name:'Ghi nhận tiền đã nhận',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();await page.screenshot({path:path.join(out,'02-confirmation.png'),fullPage:true});
 await page.getByRole('button',{name:'Quay lại kiểm tra'}).click();
 for(const width of [320,768,1024,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow '+width);await page.screenshot({path:path.join(out,`detail-${width}.png`),fullPage:true});}
 await page.getByRole('button',{name:/^Chưa lập phiếu ·/}).click();await expect(page.getByRole('table',{name:'Lượt khám chưa lập phiếu'})).toBeVisible();
 await page.screenshot({path:path.join(out,'03-unbilled.png'),fullPage:true});
 await page.getByRole('button',{name:'Ca làm việc & đối chiếu'}).click();await expect(page.getByRole('heading',{name:'Quản lý ca thu'})).toBeVisible();
 await page.screenshot({path:path.join(out,'04-shifts.png'),fullPage:true});
 assert.equal(blocked,0);assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'PASS',blockedWrites:blocked,confirmationCancelled:true,responsive:[320,768,1024,1440],screenshots:out}));
}catch(e){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});console.log(JSON.stringify({errors,tabs:await page.getByRole('navigation',{name:'Công việc thu ngân'}).innerText()}));throw e;}finally{await browser.close();}
