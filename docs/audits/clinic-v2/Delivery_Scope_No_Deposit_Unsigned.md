# Delivery scope — explicit Product Owner instruction (2026-10-01)

Task `6820c6b7-522a-4a2c-9f1b-b05d2184fb36`; branch `local-coder/clinic-management-v2-6820c6b7`.

The Product Owner asked Codex to continue coding until completion. In response to the outstanding approved-template/merchant/provider/deposit/refund question, the Product Owner explicitly selected:

> Chưa có; hoàn thiện luồng không cọc và giữ ký/phát hành, thanh toán online ở trạng thái chưa bật

This authorizes completion of the no-deposit booking/reception/unsigned clinical/onsite billing/operational patient journey. Implement drafts, internal orders/results/review, version/history, source-owned snapshots, approved-role onsite collection and internal receipts. Preserve the separation between clinical completion, document signature/release and money.

Signing, clinical document release and online collection remain disabled. No production signature/legal approval, merchant/provider integration, platform custody, deposit/refund thresholds or tax invoice is inferred. Medical fields and structural validation in synthetic fixtures are a proposed draft baseline awaiting qualified review, not approved medical/legal forms. The existing OD decisions remain OPEN.

User permission persists for the repository implementation and relevant synthetic verification; this does not update A1–A6 or release sign-off to ACCEPTED. No instruction to commit/merge/push/deploy or modify/reset existing production databases was given.
