# CMV2 — Task-based Wireframes v0.1

The prototype HTML is a high-fidelity clickable reference; ASCII layouts below are annotated functional wireframes. `[ ]` denotes a surface, `(*)` primary task action. Content is synthetic. Screens must have loading, empty, error, denied, and stale variations in implementation.

## WF-01 Public discovery — FR-PUB-01/02/03
```
HEADER [Logo] [Tìm phòng khám, dịch vụ, bác sĩ ______] [Lịch của tôi]
HERO   Khám đúng nơi, đúng thời điểm     [Tìm kiếm (*)]
LEFT   [Vị trí] [Chuyên khoa] [Khoảng giá] [Lọc]
MAIN   [Số kết quả] [Clinic card: đã xác minh | cơ sở | địa chỉ | chuyên khoa]
       [Clinic card: dịch vụ/giá tham khảo | chi nhánh | Xem chi tiết (*)]
DETAIL [Tên + thông tin nguồn] [Chi nhánh] [Chuyên khoa] [Bác sĩ] [Bảng giá]
       [Đặt lịch (*)]
```
Reject unapproved clinic even if search index is stale; booking revalidates live slot.

## WF-02 Booking — FR-PUB-04/05, FR-SCH-02/04
```
[Back to clinic]  1 Chọn lịch — 2 Người khám — 3 Kiểm tra — 4 Xác nhận
[Chi nhánh] [Dịch vụ] [Bác sĩ / Theo chuyên khoa]
[Ngày: date input] [09:00] [09:30] [10:00] [slot not available text]
[Họ tên] [Điện thoại] [Năm sinh or DOB] [Ghi chú optional]
[Policy and payment summary, recipient, deposit if configured]
[Confirm (*)] [Pending verification] → [Appointment code + next steps]
```
A slot click is not a confirmed booking. Review screen shows amount and terms before final action.

## WF-03 Patient portal — FR-PUB-06/07/08
```
[My appointments] [Released documents] [Payments] [Dependents]
[Appointment code] [Clinic/branch] [Time] [Status] [Change/cancel policy]
[Encounter] [Released result/prescription] [Author/clinic/date]
[Paid / refund processing / balance] [Receipt preview]
```
No unreviewed clinical document or other clinic's private record.

## WF-04 Clinic onboarding + manager — FR-ORG-01/02/03/04/05
```
[Active clinic ▾][Branch ▾][Role ▾]                    [Save draft]
[Tenant profile] [License fields] [Branch address/hours] [Staff & assignment]
[Specialties] [Service prices/version] [Preview public profile]
[Submit for review (*)] [Status + reason if needs_changes]
```
Published status requires separate platform approval; not every owner can publish directly.

## WF-05 Front desk today — FR-SCH-05/06/07/08/09
```
[Today] [Search patient / appointment] [+ Walk-in (*)]
[Summary: booked | waiting | seeing doctor | exceptions]
[Appt Code] [Patient Code] [Patient] [Doctor] [Time] [Status] [Check-in]
[Walk-in form + duplicate suggestions, confirm identity, choose service]
[Queue: call | skip with reason | transfer with reason]
```
Avoid excessive vertical scroll; keep today's work above fold. Queue code is distinct from patient code.

## WF-06 Doctor encounter — FR-MED-01..10
```
[My assigned queue] → [Encounter header: patient | clinic | code | status]
[Tabs: Overview | Clinical note | Orders/results | Prescription | Timeline]
[Allergy warning] [Vitals] [Chief complaint / exam / diagnosis]
[Save draft] [Order lab] [Await results] [Review result]
[Prescription rows] [Follow-up instructions] [Sign with confirm (*)]
```
Sign action cannot be conflated with closing bill or publishing portal.

## WF-07 Lab results — FR-MED-05/06/07
```
[Assigned orders] [Order status] [Result entry] [Resulted]
[Doctor review queue] [Reviewed / not reviewed]
```

## WF-08 Cashier — FR-BIL-01..11
```
[Search encounter / bill] [Charges + snapshots] [Deposit] [Paid] [Remaining]
[Record onsite payment] [Check verified online state] [Partial amount]
[Receipt] [Refund request/approval] [Shift close and variance]
```
Never show receipt as tax invoice unless legal/finance design approved.

## WF-09 Platform Console — FR-ORG-02/07
```
[Submissions] [Clinic draft/submitted/needs_changes/approved]
[Checklist evidence] [Request changes with reason] [Approve publication]
[Payments support] [Audit] — NO clinical notes/encounter details.
```

## Cross-role workflow rehearsal
A: clinic search → doctor/service slot → booking → reception check-in → doctor note/order/result/prescription/sign → cashier verifies onsite or online payments → portal released document.
B: no account/no booking → receptionist create walk-in → queue → doctor encounter → onsite payment → release/optional link to portal.
