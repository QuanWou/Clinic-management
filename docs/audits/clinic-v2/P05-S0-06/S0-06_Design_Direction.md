# P05-S0-06 — Design Direction (locked before implementation)

Date: 2026-09-30
Source basis: Phase 04 UX documents + user design decisions in current project conversation.

## Locked visual direction

- Overall model: three distinct experiences on one design system.
  - Public Platform: friendly healthcare marketplace.
  - Clinic Workspace: professional desktop SaaS with balanced density.
  - Platform Console: technical moderation/operations interface, visually distinct enough to avoid clinic-context confusion.
- Brand inheritance: preserve only the green family from V1, not the old layout/components.
- Primary brand: `#087F62`; darker `#075C50`; accent `#10B981`; soft `#EFFAF6`.
- Background: white.
- Border: neutral, low contrast; no permanent green outline around every field.
- Radius: light, controls ~7–8 px; cards ~9–10 px.
- Typography: Inter when available, then Segoe UI/Arial/system stack. Vietnamese-first.
- Iconography: Lucide; outline by default, combined with tinted active states; no emoji in operational UI.
- Density: balanced.
- Target: laptop/desktop only for S0-06 implementation baseline; tested minimum width 1180 px. Responsive/mobile implementation is explicitly deferred by current owner preference despite P04 broader responsive proposal.
- Photos: real clinic/doctor photography is the preferred production content. S0-06 shell uses fixed remote healthcare photos only as visual placeholders and never presents them as actual provider evidence.
- Dashboard: charts are primary, followed by action-first operational list.
- Status semantics: success/info/warning/danger/neutral always use text plus color; hue alone is not status.
- UI states: loading skeleton, empty, denied, error and partial must all contain recovery language; raw HTTP status is never the sole user-facing explanation.

## Navigation choice

Clinic Workspace:
- collapsible left sidebar;
- fixed top bar;
- owner manages one clinic only in this UI;
- active Clinic and owner role stay visible on every staff screen;
- no clinic/branch switcher is shown in Workspace;
- backend branch entities may remain for source-owned workflows, but branch is treated as data/filter rather than a top-level Workspace context;
- every branch/object access still requires server-side authorization.

Platform Console:
- separate navigation and context header;
- does not pretend to be a clinic role;
- default shell explicitly states that clinical notes/encounter details are not visible.

Public:
- normal marketplace header; no staff sidebar;
- persistent high-priority search entry;
- one search box for clinic, doctor, specialty or service;
- clinic detail IA follows P04 planned order.

## Information hierarchy

Public home:
1. Marketplace search
2. Suggested discovery shortcuts
3. Approved/verified clinic cards
4. How-it-works explanation

Workspace dashboard:
1. Current tenant context
2. KPI cards
3. Operational charts
4. Work needing attention
5. Links to source-owned workflows

Platform Console:
1. Platform scope/privacy notice
2. Review queue summary
3. Clinic submission list
4. Admin/audit paths without clinical bodies

## S0-06 boundary

S0-06 implements shells, shared visual states and testable API/client contracts only. It does not fabricate:
- Search projection truth (S1)
- slot availability/booking truth (S1)
- patient/queue (S2)
- encounter/medical workflows (S3)
- billing/revenue (S4)

Synthetic data is visibly labeled in the shell. Production UI must show empty/unavailable states until the relevant source API exists.
