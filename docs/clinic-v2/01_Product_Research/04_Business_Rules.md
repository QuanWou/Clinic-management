# 04 — Business Rules
| ID | Quy tắc [PROPOSED] |
|---|---|
| BR-01 | Appointment khác Encounter; walk-in có encounter mà không cần appointment. |
| BR-02 | Slot khả dụng xét bác sĩ, chi nhánh, phòng/thiết bị nếu cần, thời lượng, nghỉ, lịch đã giữ và booking. |
| BR-03 | Đặt slot dùng transaction/unique constraint hoặc cơ chế khóa phù hợp; retry idempotent. |
| BR-04 | Appointment lifecycle: pending -> confirmed -> checked_in -> completed; nhánh canceled/no_show/rescheduled. Không dùng trạng thái appointment thay cho trạng thái khám. |
| BR-05 | Encounter lifecycle: waiting -> in_progress -> awaiting_results -> in_progress -> clinically_completed -> signed/closed; cho phép nhánh chuyển tuyến/hủy có lý do. |
| BR-06 | Order xét nghiệm có trạng thái riêng: ordered -> accepted -> in_progress -> resulted -> reviewed; kết quả không tự thay thế chẩn đoán. |
| BR-07 | Chỉ bác sĩ được phân công và có quyền hợp lệ xác nhận chuyên môn. |
| BR-08 | Bill có line item snapshot giá, nguồn phát sinh, điều chỉnh và người duyệt; không tính tiền từ dữ liệu UI. |
| BR-09 | Payment và refund là sự kiện riêng; trạng thái thanh toán được tính từ ledger, không sửa trực tiếp theo nút UI. |
| BR-10 | Webhook payment xác minh chữ ký, idempotency, số tiền, đơn vị tiền, order/tenant và trạng thái. |
| BR-11 | Một user có nhiều membership; mỗi request có active tenant context rõ ràng. |
| BR-12 | Mọi truy cập bệnh án phải kiểm tra relationship/assignment/need-to-know ở backend. |
| BR-13 | Hồ sơ đã xác nhận cần version/addendum, tác giả, thời gian, lý do thay đổi. |
| BR-14 | Thông báo không chứa thông tin sức khỏe nhạy cảm trong push/SMS mặc định. |
| BR-15 | Mã patient, appointment, encounter, invoice là định danh khác nhau; không dùng mã hiển thị làm khóa quan hệ. |

## State transition cần thiết kế tiếp
Appointment, SlotHold, QueueTicket, Encounter, ClinicalOrder, Prescription, Bill, Payment, Refund, ClinicOnboarding, Membership.
## Quy tắc còn cần phỏng vấn
Thời gian giữ slot; chính sách no-show; cách thu tiền trước/sau; ngưỡng hoàn tiền; thứ tự hàng đợi; điều kiện đóng encounter.
