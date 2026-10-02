# Clinic Management V2 — Phase 04 UX/UI

**Scope:** public marketplace & patient portal + clinic workspace (includes separate platform admin mode). Click-through HTML prototype uses sample-only state, no real backend. Brand alias `ClinicCare` is a placeholder.

## Open prototypes
- `prototype/public.html` — patient discovery, booking, portal.
- `prototype/workspace.html` — management, reception, doctor, billing, platform review, state gallery.
- Shared CSS/JS in `prototype/assets`. Open locally in browser or serve static; no build.
- Simulated data is shared through browser localStorage if same origin; when opening `file://` in some browsers, origin/storage restrictions may prevent shared state. For reliable cross-page state run `python -m http.server 8000` from package root and navigate to `http://localhost:8000/prototype/public.html`. This command is documentation only; no actual project server was launched.

## Documentation
1. `docs/01_UX_Strategy_and_Sitemap.md`: information architecture and site maps.
2. `docs/02_Design_System.md`: tokens, typography, components, accessibility, copy.
3. `docs/03_Wireframes.md`: nine annotated key layouts.
4. `docs/04_Workflow_Prototype_and_Test_Plan.md`: click-through tests and review gates.
5. `docs/05_Screen_Inventory_and_Traceability.md`: PRD→screen mapping.
6. `docs/06_UX_Acceptance_Matrix.md`: acceptance criteria and test evidence expectations.
7. `docs/07_Design_Handoff_Backlog.md`: implementation slices and decision gates.
8. `diagrams`: three Mermaid maps.

## Critical open decisions
From Phase 02/03: merchant of record/platform collecting on behalf; deposit/cancel/refund policy; formal clinical templates and signature; cross-clinic sharing; receipt vs legal tax invoice. UI uses explicit demo assumptions and does not present them as enacted policy. No real patient data, no V1 files edited.

## Visual navigation
Open `index.html` for launchpad, `wireframes.html` for nine visual wireframe tiles, and `design-system.html` for the live component sample. Screens are handcrafted and no image assets from third-party UI designs are redistributed.


## Validation status
Static package checks (`tests/check_package.py`) pass; local Chromium browser E2E navigation was blocked by host administrator. Interactive workflows therefore require manual browser review and stakeholder testing before approval.
