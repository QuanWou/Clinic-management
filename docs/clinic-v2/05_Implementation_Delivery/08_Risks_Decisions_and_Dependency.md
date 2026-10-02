# 08 — Decision log và risk register cho kế hoạch triển khai

## Product decisions (kế thừa nguyên trạng, không tự chốt)
**LOCKED:** DL-001 Marketplace+SaaS; DL-002 General Clinic; DL-003 Outpatient; DL-004 Hybrid Payment.

| OD | Quyết định còn mở | Owner ký | Slice bị ảnh hưởng | Điều kiện unblock |
|---|---|---|---|---|
| OD-01 | Merchant/beneficiary online, clinic merchant hay platform collects | Finance/Legal | S1 deposit, S4 | Hợp đồng/đối soát/fees/refund flow được duyệt |
| OD-02 | Cọc và TTL/chính sách booking | PO/Clinic | S1 | Mức cọc, release, timeout & late callback |
| OD-03 | No-show, cancel, refund | PO/Clinic/Finance | S1/S2/S4 | State, approve, SLA, payer/beneficiary |
| OD-04 | Chọn doctor hay specialty pool | Clinic/Medical | S0/S1/S2 | Assignment/slot semantics |
| OD-05 | Biểu mẫu/ký hồ sơ | Medical/Compliance | S3/S5 | Fields/sign/version/release checklist |
| OD-06 | Chia sẻ cross-branch/clinic | Privacy/Medical | S0/S3/S5 | Default deny + legal access/audit model |
| OD-07 | Lab/pharmacy nội bộ hay đối tác | Clinic | S3 | P0 internal boundary, P1 partner contract |
| OD-08 | Biên nhận/hóa đơn thuế | Accounting/Legal | S4 | Issuer/document kind/integration policy |
| OD-09 | Workload and SLA/RPO/RTO | PO/Tech | S0/S6 | Measured targets and recovery budgets |
| OD-10 | Patient matching & guardian | Privacy/Clinic | S1/S2/S5 | Verification, relationship/revocation |
| OD-11 | Hồ sơ pháp lý clinic được public | Legal/Platform | S0/S1 | Approval checklist, fields allowed in listing |
| OD-12 | Migration duplicate mapping V1 | Tech/Clinic | S6 | Rule, reconciliation report and audit |

**Architecture decisions still to approve:** broker, deployment boundaries, tenant isolation tier, EMR signature/archival, accounting/legal collection arrangement, clinical forms, branch chart sharing. Do not choose technology/provider/production policy merely because it exists in a draft.

## Risk register
| Risk ID | Tác động | Trigger/dấu hiệu | Giảm thiểu & kiểm thử | Owner |
|---|---|---|---|---|
| R-01 | Cross-tenant PHI leak | mismatched header, pooled DB context | fail closed, RLS+object auth, AT-026/036/043 | Security |
| R-02 | Overbooking | concurrent hold, stale search | source transaction/capacity, AT-006/007 | Appointment |
| R-03 | Double billing | event replay, retry | unique source charge, inbox, AT-017/030 | Billing |
| R-04 | Paid without confirmed slot | late webhook after TTL | exception/compensation, AT-042 | Appointment/Billing |
| R-05 | Wrong patient link | shared contact, guardian misuse | verified identity, reviewable merge, AT-044/047 | Patient/Privacy |
| R-06 | Illegal/incomplete clinical sign | missing form/provider approval | OD-05 Medical/Compliance gate, AT-058/061 | Medical |
| R-07 | Money beneficiary mismatch | platform vs clinic receipts combined | OD-01/08, separate ledger, AT-021/065 | Finance/Legal |
| R-08 | Data loss migrating V1 | ID collision/orphan | mapping, restore, AT-038/040 | Data/Clinic |
| R-09 | Event missing/replayed | broker outage | durable outbox/inbox, DLQ, AT-039 | Platform |
| R-10 | UX false success | provider unknown/queue lag | pending/error states, source refresh, UX-A20/25 | UX/QA |
| R-11 | Source mismatch | Phase 03 proposed vs V1 actual | S0 read-only audit, ADR/change control | Tech |
| R-12 | Test data disclosure | real chart in screenshot or logs | synthetic-only, redaction, review artifacts | QA/Privacy |

## Change control
`CR ID → source/affected requirement → proposal → options → impact on schema/API/event/UI/tests/data/legal → owner approvals → updated version → rollback/deprecation notes`. Never silently move `OPEN → LOCKED` from an engineering assumption.
