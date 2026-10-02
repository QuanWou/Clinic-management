# 06 — Dữ liệu thử nghiệm tổng hợp & môi trường (đặc tả, không seed)

## 1. Phân loại môi trường
| Env | Mục tiêu | Dữ liệu | Đối tác thanh toán / thông báo |
|---|---|---|---|
| Local developer (khi phát triển) | Service unit/contract | Fixtures giả, có thể khôi phục | mock stub có kịch bản lỗi |
| Integration sandbox | API/event/DB integration | Synthetic tenant A/B | provider sandbox; email/SMS sink |
| Staging | E2E và security/financial/load/restore drill | Synthetic dataset độc lập | sandbox credential tách prod, ký webhook đúng contract |
| Pilot | Thử vận hành có kiểm soát sau duyệt | Dữ liệu được cấp phép, theo chính sách phê duyệt | phương án live riêng, policy ký |
| Production | Rollout | Dữ liệu thực có căn cứ xử lý | credential/key và access riêng biệt |

Không copy dữ liệu bệnh nhân thực từ production sang staging/dev; nếu cần nghiên cứu migration V1, dùng bản sao có kiểm soát, tối thiểu hóa/khử định danh theo phê duyệt và chính sách liên quan; tránh công bố dữ liệu y tế qua artefact/screenshot.

## 2. Bộ fixture tối thiểu
| Nhóm | Fixture | Mục đích |
|---|---|---|
| Clinics | `CL-A` approved/public; `CL-B` approved/private or separately scoped; `CL-DRAFT` not approved; `CL-SUSP` suspended | index gating, tenant isolation, suspension |
| Branches | `A-B1`, `A-B2` khác giờ và bảng giá; `B-B1` | branch scope, schedule, price |
| Doctors | `DR-A1` làm A-B1/B2, `DR-B1` ở B-B1, `DR-ABSENT` có lịch nghỉ | affiliation, worklist, absence |
| Staff | owner A, manager A, receptionist A-B1, cashier A-B2, lab A-B1, cross-clinic user, revoked staff | membership and least privilege |
| Patients | `PT-01` có portal; `PT-02` walk-in chưa có web; `PT-03` trùng thông tin liên hệ giả; `PT-04` depend­ent; guardian verified/revoked | matching, guest and guardian |
| Services | khám tổng quát, xét nghiệm giả `LAB-X`, prescription item từ danh mục test, follow-up; giá version v1/v2 khác nhau | source charge/snapshot |
| Schedules | slot capacity 1; slot 2; expired hold; concurrent reservations; late arrival | atomicity, TTL, no-show |
| Visits | booked checked-in, walk-in, awaiting lab result overnight, clinical completed not paid, signed not released | independent lifecycles |
| Billing | bill paid, partial, online pending, provider unknown, refund requested/approved, money per beneficiary | ledger and exception |
| Notifications | delivered, transient failed, replayed, suppressed due to preference | queue, privacy and dedup |

Tất cả tên/số điện thoại/địa chỉ/giấy phép trong fixture là giả và cần gắn nhãn `SYNTHETIC`; không dùng dữ liệu nhận diện giống người thật để test public search.

## 3. Matrix dữ liệu trường hợp đặc biệt
- `TD-01` Bệnh nhân có cùng số liên lạc giả nhưng khác người → gợi ý trùng, không auto merge.
- `TD-02` Cùng một user staff có membership A và B, đổi context sau request cũ → response/caches không nhiễm.
- `TD-03` Appointment price v1 sau đó catalog publish v2 → bill giữ snapshot đúng policy.
- `TD-04` Slot capacity 1 và 50 yêu cầu hold đồng thời → tối đa một active success theo rule.
- `TD-05` Hold expired + provider paid late → không chiếm lại slot, exception/refund.
- `TD-06` One source order event replay 5 lần → một charge.
- `TD-07` Result returned after midnight → encounter vẫn awaiting review.
- `TD-08` Signed document correction → addendum, version history và audit.
- `TD-09` Guardian revoked after cached portal → denied.
- `TD-10` Forged webhook / wrong amount / wrong merchant → no ledger success.
- `TD-11` Partial bill 500.000 VND + onsite 200.000 VND → remaining 300.000 VND (ví dụ của AT-018).
- `TD-12` Clinic direct and platform collection cùng ngày → đối soát tách beneficiary.
- `TD-13` Refund replay and concurrent cashier → no double refund/overcollect.
- `TD-14` Clinical record signed but payment pending → trạng thái riêng.
- `TD-15` Notification content contains internal diagnosis → test reject/sanitize before external delivery.

## 4. Tải và vận hành
Định nghĩa workload cần PO/Tech ký trước khi benchmark: số clinic/branch, bác sĩ, booking/giây, queue trong ngày, thời lượng lưu hồ sơ, kích thước file, webhook burst, peak giờ cao điểm, service downtime mục tiêu. `NFR/SLA/RPO/RTO` vẫn `[OPEN OD-09]`; tài liệu không đưa ngưỡng production tùy tiện.

## 5. Test identity/sandbox hygiene
- Account mỗi role riêng, audit distinct actor; không dùng một tài khoản admin cho mọi step.
- Sandbox credentials được giữ ngoài tài liệu, vault/secret manager theo quy định triển khai.
- Không ghi full token, provider key hay sensitive content vào screenshots/test logs.
- Có fixture registry: ID, version, lifecycle, owner, cleanup method, reset boundary và expected domain state.
