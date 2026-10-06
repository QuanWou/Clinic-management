import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
const gateway=process.env.CLINIC_GATEWAY_URL??'http://127.0.0.1:8090';
const target=new URL(gateway);
if(target.protocol!=='http:'||target.hostname!=='127.0.0.1')throw new Error('Local gateway URL required');
export default defineConfig({
 plugins:[react()],
 build:{manifest:true},
 server:{host:'127.0.0.1',port:4176,proxy:{'/s1':{target:gateway}}},
 preview:{host:'127.0.0.1',port:4177}
});
