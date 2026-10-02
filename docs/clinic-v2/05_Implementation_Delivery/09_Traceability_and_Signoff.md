# 09 — Traceability và sign-off

Bảng này liên kết **nhóm** yêu cầu; full pairwise FR↔AT vẫn tra trong Phase 02 `Traceability.md`. Các ID `AT-E2E-*` trong gói Phase 05 là **đề xuất bổ sung**, chưa là test đã duyệt của Phase 02.

| Slice | PRD FR groups | Phase 04 UX | Phase 02 AT | Phase 03 ARCH | Evidence/gate |
|---|---|---|---|---|---|
| S0 Foundation | FR-ORG-01..07, FR-IAM-01..05, FR-OPS-04/05 | UX-A09/10/23/24/25 | AT-001–005/025/026/035/038/043/045/046–049/050/068 | ARCH-01/02/03/15/16 | A0 |
| S1 Booking | FR-PUB-01..06, FR-SCH-01..05, FR-BIL-04/06/11 if deposit | UX-A01–06/09/20 | AT-005–008/029–031/042/050–055/057/066 | ARCH-04/05/09/10 | A1 |
| S2 Reception | FR-IAM-05/06, FR-SCH-05..09, FR-MED-01/02 | UX-A11–13/25 | AT-009–011/044/055–057 | ARCH-06 | A2 |
| S3 Clinical | FR-MED-01..11 | UX-A14–17/07 | AT-011–015/023/028/034/041/058–061 | ARCH-07/08/13 | A3 |
| S4 Billing | FR-BIL-01..11, FR-PUB-08 | UX-A18–21 | AT-016–021/029–033/042/045/062–065 | ARCH-09/10/11/14 | A4 |
| S5 Aftercare | FR-PUB-06..08, FR-IAM-07/08, FR-OPS-01..03 | UX-A06–08/20/25 | AT-022/024/025/034/037/060/066/067 | ARCH-02/13 | A5 |
| S6 E2E/cutover | all P0 groups + NFR | UX-A01–25 | AT-001–068 + E2E-ONLINE/WALKIN | ARCH-01–16 | GATE-A–E |

## New proposed acceptance additions

Implementation evidence 2026-10-01: [S1 checkpoint](../../audits/clinic-v2/P05-S1/S1_Implementation_Evidence.md), [S2 checkpoint](../../audits/clinic-v2/P05-S2/S2_Implementation_Evidence.md). A0 was accepted by Product Owner in the [separate foundation decision](../../audits/clinic-v2/A0_Foundation_Gate_Decision.md). The reviewer table below is not updated to APPROVE for A1/A2 or release gates by implementation tests. S2 now demonstrates server receipt recovery and source absence intervals with explicit batch propagation; AT-057 remains partial until absence resolution and approved policy remediation are demonstrated. Các checkpoint phía dưới ghi thời điểm riêng; trạng thái continuation mới nhất ở phần cập nhật cuối tài liệu.

[S3-01 continuation](../../audits/clinic-v2/P05-S3/S3_Implementation_Evidence.md) adds doctor UI, keyed start/wait/queue-return and same-encounter overnight retention, verified by 109 selected backend tests, eight packages, 22 UI tests, three browser fixtures and real care HTTP/Audit flow. AT-012/013 still needs authenticated Medical result/review; AT-028 still needs denied-care audit and full clinical read coverage. No A3 acceptance is inferred.

- `AT-E2E-FOLLOWUP`: Given signed/released encounter and follow-up recommendation, When patient/reception books follow-up, Then **new** appointment links previous encounter, no mutation of prior signed version, calendar capacity respected, branch access rechecked.
- `AT-E2E-PENDING`: Given provider unknown or broker delay, When patient reloads the confirmation page, Then UI shows verifiable pending/retry, never falsely `paid`/`confirmed`; idempotency persists.
- `AT-E2E-PUBLICATION`: Given clinic suspended after paid bookings exist, When new visitor searches/holds and old patient opens portal, Then new booking blocked, historical booking/money/record retained and exception notification handled per policy.
These additions require QA/PO approval before being appended to master Acceptance Matrix.

## Ownership RACI shorthand
`A` final signoff, `R` creates/reviews evidence, `C` consulted, `I` informed.
| Work | PO | Clinic Ops | Medical | Finance/Legal | Privacy/Security | Tech | QA |
|---|---|---|---|---|---|---|---|
| Business scope | A | C | C | C | C | R | I |
| Clinic/queue workflow | A | R | C | I | C | R | R |
| Clinical forms/sign | I | C | A | C | C | R | R |
| Payment/refund/settlement | I | C | C | A | C | R | R |
| Authorization/data access | I | C | C | C | A | R | R |
| E2E release evidence | A | C | C | C | C | R | R |

## Review checklist / sign-off artifact
- [ ] Product scope unchanged or CR approved.
- [ ] OD-01…OD-12 statuses with owner/date and dependency updated.
- [ ] API/event owners and canonical entity identifiers reviewed.
- [ ] Both primary journeys and all related negative tests have expected states.
- [ ] Medical/finance/privacy gates signed, release policy defined.
- [ ] Every P0 FR has test/evidence owner; new follow-up acceptance approved.
- [ ] V1 audit outcomes documented; reuse/refactor/replace decided by evidence.
- [ ] Migration dry-run and rollback reviewed before production.

| Reviewer role | Name | Version | Decision APPROVE/REQUEST_CHANGES | Date | Comments |
|---|---|---|---|---|---|
| Product Owner | TBD | 0.9 | PENDING | — | — |
| Clinic Lead | TBD | 0.9 | PENDING | — | — |
| Medical Lead | TBD | 0.9 | PENDING | — | — |
| Finance/Legal | TBD | 0.9 | PENDING | — | — |
| Privacy/Security | TBD | 0.9 | PENDING | — | — |
| Tech Lead | TBD | 0.9 | PENDING | — | — |
| QA Lead | TBD | 0.9 | PENDING | — | — |

## Implementation continuation — 2026-10-02

[Operational evidence](../../audits/clinic-v2/P05-S6/Operational_Baseline_Completion_Evidence.md) ghi real-auth no-deposit booking → reception → unsigned Medical/order/result/review/completion → onsite bill/receipt/shift → own history/new follow-up, negative/replay/revoke, source exception/charge recovery, clinical read/deny audit và synthetic restore/application recovery. Backend package set: 206 selected tests/12 hash-matched builds; 62 UI tests, 14 default browser fixtures, 2 real Public + 5 real operational-read browser tests. Counts là checkpoint riêng, không cộng lại với checkpoint cũ.

AT-028 có actual same-branch unassigned Doctor 403 + source security audit; Reception clinical read 403; clinical body không vào audit. AT-038 có 13-DB synthetic restore và 5 restored application startup/read tests. Đây không hoàn thành AT-040 migration thật hoặc mọi AT-039/068 producer trong toàn platform. AT-057 có background absence/cancel/amend/source-validated resolve/recovery nhưng không suy ra policy hoàn tiền đã được duyệt.

Scope unsigned/no-deposit không thay các FR/AT đã duyệt sang sign/release/deposit/online/guardian PASS. Reviewer table và A1–A6 vẫn PENDING; release, professional forms, finance/legal/privacy, full manual accessibility/benchmark và authorized migration/traffic rollback cần sign-off riêng.

## Kiểm tra chức năng/laptop lúc 03:00 ngày 02/10/2026

[Audit](../../audits/clinic-v2/P05-S6/Scheduled_0300_Functional_Laptop_Audit.md) đã chạy ngay theo điều kiện qua giờ. Đã sửa Doctor layout/paging trên 200 lượt, draft/pending navigation protection, keyboard/focus/denied responsive, Reception shortcut và nhãn CLOSED. [Checkpoint 09](../../audits/clinic-v2/P05-S6/authenticated-checkpoint-09/summary.json): 208 selected backend tests/12 matched packages (exact prior package reuse), 65 frontend tests, 20 fixture-browser tests, 2 real Public + 5 real operational reads kiểm tra ba kích thước laptop, 13-DB restore/5 restored applications. Counts là checkpoint riêng. A1–A6/full release vẫn PENDING; signing/release/online chưa bật theo PO.
