# CMV2 — Role & Permission Matrix (chi tiết)

**Trạng thái:** `[PROPOSED]`, cần clinic owner/medical lead/privacy phê duyệt.  
**Quy ước:** C = create, R = read, U = update, A = approve/sign, X = cancel/delete logical, F = financial action, — = denied. Mọi quyền đều kết hợp `tenant + branch + ownership/assignment + state`; không có quyền nào được suy ra từ chỉ một role UI.

| Tài nguyên/thao tác | Platform Ops | Clinic Owner | Clinic Manager | Receptionist | Cashier | Doctor | Nurse | Lab | Patient/Guardian |
|---|---|---|---|---|---|---|---|---|---|
| Duyệt/publish clinic | A | R own | R own | — | — | — | — | — | — |
| Cấu hình branch, giờ | — | CRUA | CRU assigned | R | R | R assigned | R assigned | R assigned | R public |
| Nhân sự/membership | —* | CRUA own | CRU delegated | R limited | — | R own | R own | R own | — |
| Lịch bác sĩ/ca nghỉ | R public only | CRU own | CRU delegated | R/U scheduling | R availability | R/U own† | R assigned | R assigned | R public |
| Catalog/giá | R public | CRUA | CRU delegated | R | R | R | R | R | R public |
| Hồ sơ bệnh nhân hành chính | —* | R aggregate only | R operational scope | CRU assigned | R billing minimal | R assigned | R assigned | R order minimal | R self |
| Appointment | R public aggregate | R aggregate | R scope | CRUX | R billing state | R own queue | R assigned | R order-related | CRUX self policy |
| Queue/check-in | — | R aggregate | R scope | CRUX | R status | RU assigned | RU assigned | R assigned | R self status |
| Encounter clinical | — | R aggregate only | R aggregate only | R status only | R status only | CRU assigned | R/U delegated fields | R order-related only | R released self |
| Chẩn đoán/kết luận | — | — | — | — | — | CRUA assigned | R within care team | R only if needed | R released self |
| Clinical order | — | — | — | R status if needed | R charge only | CRUX assigned | R/U delegated processing | RU assigned | R released self |
| Lab result | — | — | — | R status | R charge only | RA assigned review | R assigned | CRUA assigned result | R released self |
| Prescription | — | — | — | R print status† | R price if dispensed | CRUA assigned | R delegated | — | R released self |
| Clinical document ký | — | — | — | R status | R status | A assigned valid signer | — | A result if authorized | R released self |
| Charges/Bill | R platform ledger only | R aggregate | R own/branch | R items/amount | CRUF own | R related amounts | R limited | R related order | R own |
| Offline payment/close shift | — | R/A delegated | R/A delegated | F if cashier role | CRUF own | — | — | — | R own receipt |
| Online gateway/refund/settlement | R/F platform scope | R/F clinic scope | R/F delegated | R status | F delegated | — | — | — | R own transactions |
| Audit logs | R platform security scope | R org admin audit | R delegated operations | R own actions | R own financial actions | R own chart actions | R own | R own | R disclosure log if supported |

`*` Platform support chỉ truy cập dữ liệu cá nhân/phòng khám khi có workflow hỗ trợ riêng, mục đích hợp lệ, giới hạn trường, lý do và audit; không phải quyền mặc định. `†` Phụ thuộc thiết lập cơ sở và quy định chuyên môn.

## Quy tắc quyết định quyền ở backend

1. Xác thực user/session còn hiệu lực.
2. Xác định active clinic/branch từ membership thực tế, không tin header hoặc query param một mình.
3. Xác định resource owner clinic/branch từ DB/service source of truth.
4. Kiểm tra role capability, assignment/relationship và lifecycle resource.
5. Kiểm tra chính sách privacy/consent/guardian nếu có.
6. Cho phép hoặc từ chối (403/404 theo disclosure policy), ghi security audit phù hợp.
7. Không gửi fields không cần thiết từ API; filter UI không thay thế authorization.

## Chính sách tài khoản nhiều cơ sở

- Doctor thuộc clinic A và B: riêng lịch, giá, ca, nhóm bệnh nhân và hồ sơ của từng bên.
- Owner của clinic A không thể điền `clinic_id=B` để xem dashboard của B.
- Một bệnh nhân dùng một account, nhưng việc xem hồ sơ clinic A tại clinic B phải qua chia sẻ hợp lệ, không tự bật.
- Revoke membership: lần gọi tiếp theo bị chặn kể cả token cũ còn hạn; cache permissions cần invalidation.
- Mọi vai trò quản lý chỉ xem dữ liệu tổng hợp tài chính/chuyên môn theo quyền, không cho suy luận hồ sơ từng cá nhân từ dashboard ở tập quá nhỏ.
