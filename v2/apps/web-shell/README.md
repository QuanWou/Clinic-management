# Clinic V2 Web — Public, Workspace, Platform

React/Vite, Vietnamese UI, green/white design, Lucide icons and responsive forms. Public follows the Product Owner's single-clinic decision; Workspace follows A0.

## Routes and session

- `/public` or `/`: clinic introduction, public services/prices, doctors, visit guide, address/hours and booking CTA. No clinic search or patient forms on the homepage.
- `/public/booking`: source availability, patient profile, TTL hold and no-deposit confirmation. Homepage service/doctor cards preselect source IDs. One active location is selected automatically; `branch_id` remains part of backend authorization and capacity checks.
- `/public/account`: own profile, appointments, notifications, operational history, internal receipts and eligible follow-up booking.
- `/workspace`: a fixed clinic with role-specific landing/menu. Owner/Manager overview, Receptionist reception, Doctor worklist, Lab orders/results, Cashier billing.
- `/platform`: operator-only review/publication Console; no default clinical access.
- `/login?area=public|workspace|platform`: shared password login. Public registration is available; `next=booking|account` returns to the relevant patient page.

JWT is in memory. In-app links preserve the session; reload/new tab requires login. JWT/passwords are not persisted to localStorage/sessionStorage. Every destination service re-authorizes scope. Expiry/current-token 401 clears the shared session; dirty/pending staff actions guard navigation.

## Source configuration

Local Vite proxies default to `/s1/auth`, `/s1/identity`, `/s1/clinic`, `/s1/search`, `/s1/patient`, `/s1/appointment`, etc. `v2/scripts/start-local-demo.ps1` configures actual service ports and sets `VITE_PUBLIC_CLINIC_ID` to the owned demo clinic. See `v2/LOCAL_DEMO.md` for accounts and startup.

`getSiteClinic` reads Clinic's published public source by configured ID. Without that setting, the website accepts only exactly one published clinic. Zero/multiple clinics show recovery; an unavailable configured clinic never falls back to another tenant. Search supplies only that clinic's public doctor/service projection. Appointment revalidates live publication, schedule, price, patient and capacity before holding/confirming.

No synthetic cards/charts are substituted when operational source reads fail. Local demo data is explicitly synthetic. Clinical signing/release and online payment remain disabled under the Product Owner's accepted scope.

## Design and accessibility

Homepage uses an original labelled SVG illustration and icon doctor avatars until approved facility/doctor photos exist. No invented medical claims, reviews or fake contact number. Names, description, service prices, doctors, address and opening hours come from source APIs; private license/owner contact fields do not enter Public.

Keyboard focus, skip link, labelled forms, alert/status feedback, reduced-motion support and responsive layouts are implemented. The homepage is verified at 1366, 1024 and 375 px. Staff laptop workflows are verified at 1280/1366/1440 px. These checks do not establish WCAG certification.

## Commands

Run inside this directory:

```powershell
npm test -- --maxWorkers=1
npm run build
npm run test:browser -- --workers=2
npm run dev
```

`e2e` uses intercepted API fixtures. `real-e2e` and `operational-e2e` require explicit isolated sandbox configuration; never point mutating tests at production. `node v2/scripts/verify-local-demo.mjs` from the worktree root checks the running owned demo using real APIs/browser without creating appointments or payments.

Visual-state routes `?state=loading|empty|denied|error|partial` remain development UX fixtures, not backend overrides. Evidence and accepted design direction are under `docs/audits/clinic-v2/P05-S0-06/`.
