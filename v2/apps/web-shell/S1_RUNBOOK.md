# S1 Public find and book

Public uses API-backed Search, Patient, Appointment and Notification. Workspace remains a single-clinic owner shell.

Run `npm ci`, `npm run dev`. Vite dev proxies:
- /s1/search → 8097
- /s1/patient → 8098
- /s1/appointment → 8099
- /s1/notification → 8100
- /s1/auth → existing Identity /api/auth on 8083

The auth surface uses existing Identity registration/login; Patient and Appointment verify the bearer against V2 Identity current-user API (8093 by default). Access token lives in component memory; no patient/profile/token is written to persistent browser storage. Reload requires signing in again. This does not implement a new Identity backend.

Deployment must supply same-origin gateway/BFF routes, or explicit VITE_SEARCH_V2_URL, VITE_PATIENT_V2_URL, VITE_APPOINTMENT_V2_URL, VITE_NOTIFICATION_V2_URL and VITE_AUTH_URL with the corresponding allowed origin. The Vite development proxy is not a production gateway; Vite preview does not provide these proxies.

Hold and confirmation keys remain stable for retries of the same payload, including ambiguous responses and reload. Only opaque UUID keys/timestamps and payload digests are stored in sessionStorage for up to 24 hours. After signing in and selecting the clinic again, load active server holds to continue; check existing appointments first if confirmation outcome is uncertain. Abandoned holds expire using server TTL. Profile optimistic-version conflicts require loading the current profile before writing again. Price shown before confirmation comes from the held snapshot; source publication/schedule are rechecked by the command service. Deposit is absent while OD-01/02/03 remain OPEN.

`npm test`: unit/workflow fixtures.  
`npm run build`: TypeScript + bundle.  
`npm run test:browser`: isolated Edge headless browser with API fixtures, desktop/mobile screenshots. Set PLAYWRIGHT_CHROMIUM_CHANNEL to another installed supported channel if needed. This is not a production E2E sign-off.


