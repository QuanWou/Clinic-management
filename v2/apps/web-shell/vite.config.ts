import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const sandboxPorts:Record<string,number>=JSON.parse(process.env.CLINIC_V2_PROXY_PORTS??'{}');
for(const port of Object.values(sandboxPorts)){if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid isolated proxy port');}

export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 4176, proxy: Object.fromEntries([
    ['search', 8097], ['patient', 8098], ['appointment', 8099], ['notification', 8100], ['auth', 8083], ['encounter',8101], ['medical',8102], ['billing',8103], ['catalog',8095], ['clinic',8092], ['identity',8093], ['doctor',8094]
  ].map(([service, port]) => [`/s1/${service}`, { target: `http://127.0.0.1:${sandboxPorts[service]??port}`, rewrite: (path: string) => path.replace(`/s1/${service}`, '') }])) },
  preview: { host: "127.0.0.1", port: 4177 }
});
