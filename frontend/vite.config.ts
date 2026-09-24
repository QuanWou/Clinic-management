import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Only strip same-origin dev browser origins when proxying to the
            // Gateway; leave cross-site origins in place for CORS rejection.
            if (req.headers.origin === `http://${req.headers.host}`) {
              proxyReq.removeHeader('origin');
            }
          });
        }
      }
    }
  }
});
