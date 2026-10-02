# CMV2 — Design System v0.1

## Foundations
Product alias: ClinicCare (temporary placeholder, does not rename actual project). Language `vi-VN`. Display currency as `1.250.000 ₫`, date `29/09/2026`, time `09:30`, 24-hour local time and explicit timezone when cross-zone. Use full role labels; avoid unexplained acronyms.

| Token | Value | Role |
|---|---|---|
| `--brand-700` | `#12665f` | Primary text/dark brand |
| `--brand-600` | `#15786e` | Primary action |
| `--brand-100` | `#def4ef` | Soft selection |
| `--ink` | `#16313b` | Body text |
| `--muted` | `#536b72` | Secondary text |
| `--canvas` | `#f4f8f7` | App background |
| `--surface` | `#ffffff` | Cards |
| `--line` | `#d7e4e4` | Neutral borders |
| `--danger` | `#a52730` | Error text |
| `--warn` | `#865400` | Pending/caution text |
| `--focus` | `#175cd3` | Distinct keyboard ring |

Semantic tokens: success, pending, in-progress, exception and neutral each combine **text + icon/label**, never hue alone. State badges specify e.g. 'Đã xác nhận', 'Đang khám', 'Đang chờ kết quả', 'Đã thanh toán'.

Typography: system UI stack (`Inter` if locally available, otherwise Segoe UI/Arial/system); body 15–16px, minimum supporting text 13px, line-height 1.5. Heading scale H1 34/40 desktop, H2 26/32, H3 19/27; mobile H1 27/34. Tabular numerals for dates, time, financial values. Avoid hard-coded font files or external CDN.

Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48. Radius: 8 controls, 12 cards, 18 hero panels. 1 px neutral borders on inputs/cards; 2–3 px distinct focus indicator **only on keyboard focus**, never a permanently bright outline around every field. Shadow soft and sparse.

## Components inventory
- Page shell; breadcrumbs; visible context selector (clinic/branch/role); search & filters; result card; doctor profile; verified-info label.
- Native-select/date input, segmented time slot button, progressive stepper, validation summary + field error, consent/policy disclosure, price summary, confirmation card.
- Staff KPI + action bar, indexed task list, appointment table/card, queue lane, patient matching dialog, clinical tabs, save draft indicator, clinical order/result timeline, prescription rows, irreversible action confirmation, billing charges/payments/refund state, toast/live region.
- Skeleton/empty/permission/failed-to-load/partial-success and stale-data states; no blanket 'Request failed (403)' without recovery message.

## Accessibility acceptance targets
Baseline WCAG 2.2 AA verification (not a claim that prototype passes all criteria). Visible labels, `fieldset` for grouped choices, instructions and errors near fields, keyboard navigability, skip link, focus visible, error summary, live feedback. Minimum 24×24px hit region under WCAG 2.2 AA; design target 44×44px where practical. Text contrast target at least 4.5:1 standard and UI boundaries 3:1; verify all pairings in implementation. Do not auto-submit on selecting date/time. Respect reduced motion. Never use placeholders as labels.

## High risk pattern requirements
- Slot may expire or become unavailable during step 2: preserve patient data, announce error and return to slot selection. Search results are not source of booking truth.
- Payment redirect success ≠ paid: show 'Đang xác minh', poll authoritative status; duplicate or late confirmation is reconciled.
- Clinical signed note: locked; corrections via new addendum/version with author, reason and timestamp. Signing requires explicit summary and confirm.
- Billing: display charge total, deposits, payments made, remaining balance separately. No UI button may directly update ledger without server action.
- Clinic/branch switch requires clearly visible context and server reauthorization; avoid carry-over from prior tenant.
- Patient portal: only released document; show originating clinic and document status. No internal draft preview.

## UI writing examples
- Bad: 'Lỗi 403' → Good: 'Bạn không có quyền xem hồ sơ này trong cơ sở đang chọn. Hãy chọn đúng cơ sở hoặc liên hệ quản trị viên.'
- Bad: 'Đặt lịch thành công' after payment redirect → Good: 'Đang xác minh thanh toán. Lịch hẹn sẽ được xác nhận sau khi giao dịch được đối soát.'
- Bad: 'Xong' → Good: 'Đã xác nhận bệnh án' or 'Đã thu 350.000 ₫'.
- Labels: 'Mã bệnh nhân', 'Mã lịch hẹn', 'Mã lượt khám', 'Số thứ tự'; never concatenate identifiers into unlabelled string.
