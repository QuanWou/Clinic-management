// Reuse the live API/browser checks with the main checkout's private runtime.
process.env.CLINIC_RUNTIME_DIRECTORY='.runtime/main';
await import('./verify-local-demo.mjs');
