# P05-S0-06 — UX/QA shell implementation evidence

**Date:** 2026-09-30  
**Task:** `6820c6b7-522a-4a2c-9f1b-b05d2184fb36` — Clinic Management V2  
**Branch:** `local-coder/clinic-management-v2-6820c6b7`  
**Status:** **IMPLEMENTED** for the S0-06 shell/state/contracts scope and **AUTOMATED VERIFIED** as listed below. Manual browser visual review/user usability sessions are still pending and are not claimed complete.

## 1. Locked owner design direction

The owner explicitly selected:
- three-mode hybrid: friendly Public, professional Clinic Workspace, technical Platform Console;
- preserve V1 green family only, not the old layout;
- white background;
- light corner radius;
- balanced information density;
- navigation chosen by implementation: collapsible left sidebar + fixed top context bar;
- Public/Workspace/Platform use one design system with different information density/context;
- Public home search direction researched/selected by implementation;
- clinic detail ordering follows P04 proposal;
- dashboard emphasizes charts;
- desktop/laptop only for this stage;
- Vietnamese first;
- typography selected by implementation: Inter → Segoe UI/system fallback;
- Lucide mixed outline/tinted active icon system;
- status colors accepted;
- state pages should be visually polished;
- real clinic/doctor photography preferred;
- UI is redesigned; only brand color family is inherited.

Detailed locked direction:
`docs/audits/clinic-v2/P05-S0-06/S0-06_Design_Direction.md`.

## 2. Application delivered

New isolated V2 frontend:

`v2/apps/web-shell/`

No V1 frontend files were modified.

### Public Platform shell
Routes: `/`, `/public`

Implemented:
- marketplace header;
- single discovery search for clinic/doctor/specialty/service;
- search suggestions;
- verified-profile language;
- clinic cards using synthetic content and fixed photography placeholders;
- branch count / specialty / indicative price presentation;
- explicit note that real Search projection belongs to S1;
- loading, empty, denied, error and partial routes via `?state=...`.

### Clinic Workspace shell
Route: `/workspace`

Implemented:
- collapsible left sidebar;
- fixed topbar;
- active Clinic and owner role always visible;
- owner Workspace manages one clinic only;
- clinic/branch switcher removed after owner review;
- dashboard is whole-clinic scope; branch remains a possible field/filter in later source-owned workflows rather than a top-level Workspace context;
- server-side branch/object authorization remains required even though Workspace does not switch tenants;
- chart-first dashboard;
- KPI cards;
- operational status chart;
- action-first attention list;
- onboarding/publication workflow showing:
  `Nháp → Gửi duyệt → Platform phê duyệt → Công bố`;
- explicit copy that submitting does not publish automatically;
- state surfaces with recovery text.

### Platform Console shell
Route: `/platform`

Implemented:
- separate Platform Console navigation/context;
- clear privacy boundary;
- explicit statement that Platform Ops has no default medical-chart access;
- submission/review queue;
- no clinical note/encounter body in sample data;
- loading/empty/denied/error/partial states.

## 3. Design system foundation

Implemented in `src/styles.css`:

- primary `#087F62`, inherited from V1 green family;
- dark green `#075C50`, accent `#10B981`;
- white canvas, neutral borders/shadows;
- 7–10 px operational radius;
- Inter/Segoe UI/system typography, no bundled font file/CDN;
- visible keyboard focus ring;
- skip link;
- reduced-motion fallback;
- semantic success/info/warning/danger/neutral badges;
- no permanent bright green input/card outlines;
- balanced density;
- minimum S0-06 desktop width 1180 px.

Current owner decision intentionally narrows S0-06 to laptop/desktop even though P04 originally proposed a broader responsive target. No mobile completion is claimed.

## 4. Testable backend contracts

`src/api/client.ts` and `src/types/contracts.ts` map only currently owned S0 APIs:

Identity:
- `GET /api/v2/me/current`
- `GET /api/v2/me/contexts`

Clinic:
- `GET /api/v2/public/clinics`
- `GET /api/v2/platform/clinics?status=...`

Type shapes were checked against:
- `v2/services/identity-service/.../IamDto.java`
- `v2/services/clinic-service/.../ClinicDto.java`

The shell does **not** invent dashboard/reporting/search/booking APIs that do not exist yet. Chart/card data is explicitly marked synthetic/demo.

API recovery copy distinguishes 401/403/404/409/5xx and does not show a raw status as the sole guidance.

## 5. UX acceptance traceability

| UX acceptance | S0-06 evidence | Status |
|---|---|---|
| UX-A09 | Workspace publication flow explicitly separates submit, Platform approval and publish; Platform Console review surface | **SHELL VERIFIED**; actual review authorization remains backend S0-02/03 |
| UX-A10 | Owner review changed Workspace to single-clinic management: Clinic + owner role always visible, no branch switcher; branch/object access still requires backend authorization | **SHELL CONTRACT VERIFIED** for single-clinic UX; branch-specific domain screens remain later work |
| UX-A25 | `loading/empty/denied/error/partial` state component + recovery text; no raw 403-only UX | **AUTOMATED VERIFIED** |

P04 broader UX IDs for booking, reception, medical and billing are intentionally not marked complete because their source services belong to S1–S4.

## 6. Automated verification

Dependency install:
- `npm install`
- 45 packages installed
- audit output at install time: **0 vulnerabilities**

Unit/static rendering:

```powershell
npm test
```

Result:
- 3 test files passed
- **8 tests passed, 0 failed**

Coverage of assertions:
- Public / Workspace / Platform route separation;
- required UI states;
- recovery copy instead of raw 403;
- Public marketplace search/verified language;
- single-clinic owner context visibility and absence of a branch switcher;
- owner publication approval separation;
- Platform no-default-clinical-access copy;
- denied/error recovery guidance.

Production build:

```powershell
npm run build
```

Result: **PASS**.

Built assets at final run:
- HTML ~0.56 kB
- CSS ~20.12 kB
- JS ~257.78 kB
- Vite production build completed successfully.

HTTP dev smoke:
- `/public` → 200
- `/workspace` → 200
- `/platform` → 200
- `/workspace?state=denied` → 200
- `/platform?state=partial` → 200

## 7. Manual/visual review status

An attempt was made to join the Workbench browser for direct visual screenshot review, but the shared browser profile was already leased by another Computer Use owner and returned `COMPUTER_BUSY`.

Therefore:
- no screenshot/browser-based visual sign-off is claimed;
- no manual keyboard/screen-reader/zoom certification is claimed;
- no moderated receptionist/doctor/patient usability session is claimed;
- these remain QA/owner review evidence before overall A0 acceptance.

Static/server-rendered shell tests and production compilation passed, but they do not replace visual/accessibility review.

## 8. Safety / data boundaries

- Public clinic cards and metrics are synthetic S0-06 layout fixtures.
- No real patient, appointment, medical, payment or staff record is embedded.
- Remote healthcare photographs are visual placeholders only and are not provider evidence.
- Platform sample data contains no clinical notes.
- No V1 database/frontend/runtime was modified by S0-06.
- No commit/merge/push has been performed.

## 9. Completion statement

P05-S0-06 is **source-complete for the specified shell/state/testable-contract foundation**. UX-A09/A10/A25 have implementation evidence at the shell/contract layer. Manual browser visual QA and human usability/accessibility review remain explicit pending evidence and should be completed before declaring overall A0 accepted.
