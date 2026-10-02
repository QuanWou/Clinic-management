# 03 — Backlog cấp task

## Quy ước task
`P05-Sx-yy`; `owner` là vai trò, không phải người được giao. Mỗi task có: prereq, các đầu ra, FR/AT đối chiếu, tiêu chí Done. Trạng thái triển khai theo `backlog.csv` và evidence của từng task; các đầu việc chưa cập nhật giữ `PLANNED`.

## S0 — Foundation & approval
| ID | Owner | Đầu ra và tiêu chí Done (khi triển khai) | FR / AT |
|---|---|---|---|
| P05-S0-01 | PO/Tech | Audit source V1 read-only: inventory service/schema/routes/events, reuse/refactor/replace có evidence | FR toàn P0 / AT-040 |
| P05-S0-02 | Clinic/Platform | Hồ sơ onboarding, review, publish/suspend, không public draft | FR-ORG-01/02/07 / AT-001/002/003/050 |
| P05-S0-03 | IAM/Security | Membership đa clinic/branch, revoke, object authorization, tenant connection fail-closed | FR-IAM-01/02/03 / AT-004/025/026/035/043/049 |
| P05-S0-04 | Doctor/Catalog | Affiliation, schedule, offering, price version + snapshot | FR-ORG-04/06 / AT-005/016/045 |
| P05-S0-05 | Platform/DevOps | Audit trace, non-PHI event envelope, backup/recovery checklist và synthetic environment | FR-OPS-04/05 / AT-038/039/068 |
| P05-S0-06 | UX/QA | Shell public/workspace, tenant indicator, loading/denied/empty states, testable contracts | UX-A09/10/25 |

S0-04 Doctor/Catalog source is implemented and verified on 2026-09-30: 23 unit/PostgreSQL tests passed, fresh Flyway V1–V3 and both Maven packages passed. See [implementation evidence](../../audits/clinic-v2/P05-S0-04/S0-04_Implementation_Evidence.md). AT-016/045 booking/bill integration and overall A0 sign-off remain downstream requirements.

## S1 — Discovery, patient registration & booking

Checkpoint 2026-10-01: [S1 evidence](../../audits/clinic-v2/P05-S1/S1_Implementation_Evidence.md) ghi nhận 78 tests và 8 packages PASS cùng source outbox/Search, booking/notification/audit HTTP thật. UI dùng auth hiện có; full real login/signup E2E chưa được chứng minh. S1-01..04/06 là `IMPLEMENTED_VERIFIED_SOURCE`, không phải A1 ACCEPTED. S1-05 là `CONDITIONAL_BLOCKED_OD_01_02_03`.

| ID | Owner | Đầu ra và tiêu chí Done | FR / AT |
|---|---|---|---|
| P05-S1-01 | Search/Clinic | Projection public versioned; draft/suspended không được đặt mới; stale projection recheck | FR-PUB-01/02/03 / AT-050/051/052 |
| P05-S1-02 | IAM/Patient | Signup/login hoặc booking profile hợp lệ, patient link không nhầm cơ sở | FR-IAM-01/04, FR-PUB-05 / AT-046/047/053 |
| P05-S1-03 | Appointment | Availability + hold TTL + atomic capacity + idempotency | FR-SCH-01/02 / AT-005/006/007 |
| P05-S1-04 | Appointment/BFF | Confirm, cancel, reschedule, audit, conflict/retry UI | FR-SCH-03/04/05 / AT-008/053/054/055 |
| P05-S1-05 | Billing thin-path | **Chỉ nếu OD-01/02/03 duyệt:** deposit intent, verified webhook, late callback exception/refund path | FR-BIL-04/06/11 / AT-029/030/031/042 |
| P05-S1-06 | Notification/UX | Booking status/pending/reminder, consent & safe copy | FR-OPS-01/02 / AT-037/066; UX-A03–06 |

## S2 — Reception and queue

Checkpoint 2026-10-01: [S2 evidence](../../audits/clinic-v2/P05-S2/S2_Implementation_Evidence.md) ghi nhận 104 selected backend tests, 8 packages, 18 UI tests và 2 browser fixture workflows PASS. S2-01..03 có source/API/UI và kiểm chứng synthetic; S2-04 là `PARTIAL_IMPLEMENTED_VERIFIED_SOURCE`: đã có khoảng vắng nguồn và batch 10 lịch bị ảnh hưởng, còn background propagation, amendment/cancellation/resolution và money remediation. [Rà thiếu](../../audits/clinic-v2/P05-S2/S2_Gap_Review.md) giữ các phần chưa đủ nghiệm thu; A2 chưa ACCEPTED.

| ID | Owner | Đầu ra và tiêu chí Done | FR / AT |
|---|---|---|---|
| P05-S2-01 | Patient/Reception | Tìm + matching suggestion, không auto merge, walk-in temporary profile | FR-IAM-05/06 / AT-009/044 |
| P05-S2-02 | Encounter | Create encounter without appointment, idempotent check-in from booking | FR-SCH-06/07, FR-MED-01 / AT-009/010 |
| P05-S2-03 | Encounter/UX | Queue branch/date/service point, call/skip/transfer & valid ticket codes | FR-SCH-08 / AT-011/056 |
| P05-S2-04 | Reception/Appointment | Late/no-show/doctor absent exception, no silent loss/refund | FR-SCH-09 / AT-057 |

## S3 — Medical care

Checkpoint cập nhật 2026-10-01: [Medical](../../audits/clinic-v2/P05-S3/Medical_Implementation_Evidence.md) và [unsigned completion](../../audits/clinic-v2/P05-S3/Completion_Implementation_Evidence.md) đã bổ sung note draft/version, LAB result/Doctor review, validation bất biến, complete/close và Appointment FULFILLED. Lượt completion có 130 selected backend tests, 10 packages, 30 UI tests và 4 browser fixtures PASS. S3 vẫn `PARTIAL_IMPLEMENTED_VERIFIED_SOURCE` với template/sign/release/addendum chưa được chuyên môn duyệt và đang tắt theo phạm vi PO; A3 chưa ACCEPTED.

| ID | Owner | Đầu ra và tiêu chí Done | FR / AT |
|---|---|---|---|
| P05-S3-01 | Encounter/Doctor | Assigned worklist/start/awaiting_results transitions | FR-MED-01/02 / AT-011/013/028 |
| P05-S3-02 | Medical/UX | Clinical note draft, mandatory validation and autosave semantics reviewed | FR-MED-03/04 / AT-058 |
| P05-S3-03 | Medical/Lab | Order → result → review with author/versions, wait overnight preserved | FR-MED-05/06/07 / AT-012/013/023 |
| P05-S3-04 | Medical Lead | Prescription template and doctor approval (OD-05); sign rules and addendum | FR-MED-08/09/11 / AT-014/015/041/059/061 |
| P05-S3-05 | Medical/Portal | Release gate separate signing, enforce patient/guardian on download | FR-MED-10, FR-PUB-07 / AT-014/022/034/060 |

## S4 — Hybrid revenue

[Onsite evidence](../../audits/clinic-v2/P05-S4/Onsite_Implementation_Evidence.md): 142 selected backend tests, 11 packages, 36 UI tests và 5 browser fixtures PASS; đã có giá nguồn, thu từng phần, biên nhận nội bộ, ledger cân và chốt ca với người duyệt riêng. [Charge checkpoint](../../audits/clinic-v2/P05-S4/Charge_Ingestion_Implementation_Evidence.md) bổ sung source-event inbox, independent ACK và frozen-charge reconciliation, với 176 selected tests/11 packages PASS. S4-01/02 vẫn `PARTIAL_IMPLEMENTED_VERIFIED_SOURCE`: failed-event recovery/status UI và production review còn thiếu. Online/refund/reversal/settlement tiếp tục tắt; A4 chưa ACCEPTED.
| ID | Owner | Đầu ra và tiêu chí Done | FR / AT |
|---|---|---|---|
| P05-S4-01 | Billing/Catalog | Unique charge from event, price snapshot, bill lines and approved adjustments | FR-BIL-01/02 / AT-016/017/045/062 |
| P05-S4-02 | Billing/Cashier | Onsite collection, partial, shift/collector, printable receipt accurately labeled | FR-BIL-03/07/09 / AT-018/033/063 |
| P05-S4-03 | Billing/Payments | Online verified webhook, unknown/reconcile, ledger exactly-once effects | FR-BIL-04/11 / AT-019/029/030/031 |
| P05-S4-04 | Finance/Legal | Beneficiary configurations, refund/reversal, clinic vs platform settlement | FR-BIL-05/08/10 / AT-020/021/032/064/065 |

## S5 — Portal, aftercare, operations

Checkpoint 2026-10-02: [aftercare/operations evidence](../../audits/clinic-v2/P05-S5/Aftercare_Operations_Implementation_Evidence.md) có 155 selected backend tests, 11 packages, 42 UI tests và 8 browser fixtures PASS. Portal riêng tư hoạt động với cơ sở không còn công bố; tái khám tạo booking mới bằng nguồn thật và giữ giá/lượt cũ; tổng quan Owner/Manager dùng Encounter/Billing scoped và giữ trạng thái thiếu nguồn. S5-01/02/04 là `PARTIAL_IMPLEMENTED_VERIFIED_SOURCE`; financial notifications đã có independent delivery/inbox, Patient-owned recipient và keyed lost-ACK recovery, được kiểm chứng trong các checkpoint 168/176/180. Continuous real-auth/browser journey và release validation còn thiếu. Ký/phát hành, guardian và online money vẫn chưa bật; A5 chưa ACCEPTED.
| ID | Owner | Đầu ra và tiêu chí Done | FR / AT |
|---|---|---|---|
| P05-S5-01 | Patient/Portal | My appointments/payments, released docs, revoke guardian, privacy | FR-PUB-06/07/08, FR-IAM-07 / AT-022/024/025/034 |
| P05-S5-02 | Appointment/Medical | Follow-up plan creates **new** appointment and links prior encounter; no mutate signed old record | FR-MED-04, FR-PUB-04/06 / AT-E2E-FOLLOWUP (new proposed) |
| P05-S5-03 | Notification | Released result, reminder, payment/refund status without PHI content in preview | FR-OPS-01/02 / AT-037/066 |
| P05-S5-04 | Clinic/Reporting | Role-scoped dashboard and day close, pending encounter/report exception | FR-OPS-03/05 / AT-023/064/067 |

## S6 — Validation/cutover planning
| ID | Owner | Đầu ra và tiêu chí Done | FR / AT |
|---|---|---|---|
| P05-S6-01 | QA | E2E-ONLINE and E2E-WALKIN complete including negative/async cases, evidence and defects | Phase 02 E2E; AT-001–068 |
| P05-S6-02 | Security/Privacy | Authorization matrix, PHI exposure, revoke, audit, restore | AT-025–028/034–041/043/047–049/068 |
| P05-S6-03 | SRE/Data | Migration V1→V2 dry-run on copy, reconciliation, backup/restore and rollback rehearsal | AT-038/040/061 |
| P05-S6-04 | PO/Medical/Finance/Legal | Signed release decisions, unresolved risk disposition, go/no-go | GATE-A–E / ARCH-01–16 |

## Vertical slice Definition of Done
- UI follows Phase 04 with success/pending/empty/denied/validation/error/recovery states; keyboard/accessibility reviewed.
- API & event schema owned, versioned, permission checked, contract/consumer tests and traces available.
- Source-owning DB has constraints/idempotency/outbox/inbox where relevant; migration reviewed and rehearsed on disposable data.
- Unit + integration + E2E + negative tests relevant PASS with links, not checkbox only.
- No critical/high defect or unknown monetary outcome silently marked successful; backup & rollback plan.
- Functional owner and QA sign off; medical/finance/privacy/legal gates for sensitive slices.

## Cập nhật triển khai 2026-10-02 — phạm vi PO không cọc/chưa ký

[Evidence mới nhất](../../audits/clinic-v2/P05-S6/Operational_Baseline_Completion_Evidence.md) thay các nhận xét thiếu tại checkpoint cũ: signup/password login thật, Public registration/booking thật, Medical/internal order/result/review/unsigned completion, onsite billing/receipts/shift, own operational portal/follow-up, source-charge recovery và configuration đã triển khai. Doctor absence có amendment/cancel/relay/resolve; quản lý phục hồi pending arrival, WAITING qua ngày giữ visit, queue keyset paging; clinical read/deny audit đã bổ sung.

Bộ 12 package đối chiếu hash có 206 selected backend tests từ các lượt zero-skip; lượt HTTP cuối dùng exact package reuse. Giao diện: 62 tests + build, 14 browser fixtures và 7 actual-browser tests (2 Public mutation journeys, 5 operational reads). Restore 13 synthetic DB và khởi động 5 restored applications PASS. Staff clinical/money mutations dùng actual API continuous journey và browser fixtures, chưa tuyên bố toàn bộ clinical E2E được chạy bằng browser thật.

S0 source đã verified, A0 PO ACCEPTED. S6-01/02/03 PARTIAL_IMPLEMENTED_VERIFIED_SOURCE do chưa có qualified acceptance, performance/accessibility review đầy đủ, authorized V1-copy migration và traffic rollback. Ký/phát hành, online/deposit/refund/guardian chưa bật theo PO; full composite task có các phần này vẫn PARTIAL, không tự ACCEPTED A1–A6. Các bảng/checkpoint cũ phía trên giữ lịch sử; gap reviews và evidence mới là trạng thái implementation hiện tại.

## Kiểm tra chức năng/laptop lúc 03:00 ngày 02/10/2026

[Audit](../../audits/clinic-v2/P05-S6/Scheduled_0300_Functional_Laptop_Audit.md) đã chạy ngay theo điều kiện qua giờ. Đã sửa Doctor layout/paging trên 200 lượt, draft/pending navigation protection, keyboard/focus/denied responsive, Reception shortcut và nhãn CLOSED. [Checkpoint 09](../../audits/clinic-v2/P05-S6/authenticated-checkpoint-09/summary.json): 208 selected backend tests/12 matched packages (exact prior package reuse), 65 frontend tests, 20 fixture-browser tests, 2 real Public + 5 real operational reads kiểm tra ba kích thước laptop, 13-DB restore/5 restored applications. Counts là checkpoint riêng. A1–A6/full release vẫn PENDING; signing/release/online chưa bật theo PO.
