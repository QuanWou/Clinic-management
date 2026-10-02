import {defineConfig} from '@playwright/test';
const port=Number(process.env.CLINIC_V2_REAL_WEB_PORT);
if(!process.env.CLINIC_V2_REAL_E2E_CONFIG||!Number.isInteger(port)||port<1024||port>65535)throw new Error('Explicit isolated operational browser configuration required');
export default defineConfig({testDir:'./operational-e2e',timeout:60000,workers:1,use:{baseURL:`http://127.0.0.1:${port}`,browserName:'chromium',channel:process.env.PLAYWRIGHT_CHROMIUM_CHANNEL??'msedge',headless:true},webServer:{command:`npm run dev -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false,timeout:30000},reporter:[['list']]});
