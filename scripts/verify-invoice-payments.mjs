import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
assert.ok(process.argv.includes('--live-qa'),'Use --live-qa to create and cancel unpaid provider links for the dedicated QA invoice. This never transfers funds.');
const runtime=path.join(root,'.runtime/main');
const cfg=JSON.parse(fs.readFileSync(path.join(runtime,'config.json'),'utf8').replace(/^\uFEFF/,''));
const workflow=JSON.parse(fs.readFileSync(path.join(runtime,'invoice-online-qa/without-orders/workflow-state.json'),'utf8'));
const billId=workflow.commands.bill.id;
assert.equal(workflow.commands.bill.subtotalVnd,180000);
const output=path.join(runtime,'invoice-payments');fs.mkdirSync(output,{recursive:true});
const stateFile=path.join(output,'state.json'),state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):{};
const report={status:'RUNNING',checkedAt:new Date().toISOString(),checks:[],realMoneyTransferred:false,providerConfirmation:'NOT_TESTED_WITH_REAL_FUNDS'};
const require=createRequire(new URL('../apps/web-shell/package.json',import.meta.url));const {chromium,expect}=require('@playwright/test');
let browser;const base=`/api/me/clinics/${cfg.clinic}/branches/${cfg.branch}/bills/${billId}`;
const save=()=>fs.writeFileSync(stateFile,JSON.stringify(state,null,2));
const check=name=>{report.checks.push(name);console.log('PASS: '+name);};
async function login(account){const r=await fetch(`http://127.0.0.1:${cfg.ports.auth}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:account.email,password:account.password})});assert.equal(r.status,200);return(await r.json()).data.accessToken;}
async function api(route,token,expected=200){const r=await fetch(`http://127.0.0.1:${cfg.ports.billing}${route}`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(r.status,expected);return r.json();}
try{
 const account=cfg.accounts[cfg.primaryAccounts.patient],token=await login(account),other=await login(cfg.accounts.doctor);
 const rows=await api(base,token);assert.equal(rows.remainingVnd,180000);const denied=await fetch(`http://127.0.0.1:${cfg.ports.billing}${base}`,{headers:{Authorization:`Bearer ${other}`}});assert.ok([403,404].includes(denied.status));check('Only the patient account can access its issued invoice');
 const methods=await api(base+'/payment-methods',token);assert.equal(methods.find(m=>m.code==='PAYOS').available,true);assert.equal(methods.find(m=>m.code==='VNPAY').available,true);check('Lunar payOS and VNPAY are configured through server-only runtime');
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const web=`http://127.0.0.1:${cfg.ports.web}`;await page.goto(web+'/login?area=public');await page.getByLabel('Email',{exact:true}).fill(account.email);await page.getByLabel('Mật khẩu',{exact:true}).fill(account.password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page.getByRole('button',{name:'Đăng xuất',exact:true})).toBeVisible({timeout:20000});
 await page.getByRole('link',{name:'Tài khoản bệnh nhân',exact:true}).click();await page.getByRole('button',{name:'Lịch sử & chi phí',exact:true}).click();const fees=page.locator('.patient-fees');await expect(fees.getByText(/Còn phải thu:.*180.000/)).toBeVisible({timeout:15000});
 const panel=fees.locator('.invoice-payment');if(await panel.getByRole('button',{name:'Chọn cách trả phí'}).count())await panel.getByRole('button',{name:'Chọn cách trả phí'}).click();await expect(panel.getByRole('radio',{name:/VNPAY/})).toBeVisible({timeout:15000});
 for(const width of [1366,1024,375]){await page.setViewportSize({width,height:768});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await panel.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,`payment-methods-${width}.png`),fullPage:true});}await page.setViewportSize({width:1366,height:768});check('Patient payment method UI fits laptop and mobile widths');
 if(!state.payosCancelled){
  if(!state.payosId){let first=true;await page.route('**/payment-intents',async route=>{if(route.request().method()==='POST'&&first){first=false;const response=await route.fetch();assert.equal(response.status(),200);const value=await response.json();state.payosId=value.id;save();await route.abort('failed');}else await route.continue();});await panel.getByRole('radio',{name:/payOS/}).check();await panel.getByRole('button',{name:'Tạo liên kết thanh toán'}).click();await expect(panel.getByRole('button',{name:'Kiểm tra lại yêu cầu hiện tại'})).toBeVisible({timeout:30000});await page.unroute('**/payment-intents');await panel.getByRole('button',{name:'Kiểm tra lại yêu cầu hiện tại'}).click();}
  const payos=await api(base+`/payment-intents/${state.payosId}?reconcile=true`,token);assert.equal(payos.status,'PENDING','payOS must return a verified usable link');assert.ok(payos.qrCode);await expect(panel.getByRole('img',{name:'Mã QR thanh toán phiếu thu'})).toBeVisible({timeout:15000});assert.equal((await api(base+'/payment-intents',token)).filter(i=>i.provider==='PAYOS').length,1);check('Real payOS link recovers a deliberately dropped response without a second intent');
  await panel.getByRole('button',{name:'Hủy liên kết để chọn cách khác'}).click();await expect(panel.getByText(/Đã hủy liên kết/)).toBeVisible({timeout:30000});assert.equal((await api(base+`/payment-intents/${state.payosId}`,token)).status,'CANCELLED');state.payosCancelled=true;save();check('Real payOS cancellation is confirmed before method choice unlocks');
 }
 if(!state.vnpayId){await panel.getByRole('radio',{name:/VNPAY/}).check();await panel.getByRole('button',{name:'Tạo liên kết thanh toán'}).click();await expect(panel.getByRole('link',{name:'Mở VNPAY để thanh toán'})).toBeVisible({timeout:15000});state.vnpayId=(await api(base+'/payment-intents',token)).find(i=>i.provider==='VNPAY').id;save();}
 const intent=await api(base+`/payment-intents/${state.vnpayId}`,token);const url=new URL(intent.checkoutUrl);assert.equal(url.host,'sandbox.vnpayment.vn');assert.equal(url.searchParams.get('vnp_Amount'),'18000000');assert.equal(new URL(url.searchParams.get('vnp_ReturnUrl')).origin,web);assert.ok(url.searchParams.get('vnp_SecureHash'));check('VNPAY sandbox checkout carries the frozen invoice amount and clinic return URL');
 const bank=await context.newPage();await bank.goto(intent.checkoutUrl);await expect(bank.locator('body')).not.toBeEmpty();await bank.screenshot({path:path.join(output,'vnpay-sandbox.png'),fullPage:true});report.vnpayPage={status:'OPENED',title:await bank.title()};
 const after=await api(base,token);assert.equal(after.remainingVnd,180000);assert.equal(after.receipts.length,0);assert.equal((await api(base+`/payment-intents/${state.vnpayId}?reconcile=true`,token)).status,'PENDING');check('Opening a provider page or return does not create a receipt or alter the balance');
 assert.deepEqual(errors,[]);report.status='PASS';console.log(`PASS: ${report.checks.length} real invoice/payment/browser checks; no money transferred.`);
}catch(e){report.status='FAIL';report.error=e.message;process.exitCode=1;console.error(e.message);}finally{await browser?.close();fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(report,null,2));}
