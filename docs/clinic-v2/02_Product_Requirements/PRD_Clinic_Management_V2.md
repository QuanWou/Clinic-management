# PRODUCT REQUIREMENTS DOCUMENT — CLINIC MANAGEMENT V2

**Mã tài liệu:** CMV2-PRD-001  
**Phiên bản:** 0.9 — baseline nghiệp vụ để duyệt, chưa phải phê duyệt triển khai  
**Ngày:** 29/09/2026  
**Phạm vi đã chốt:** Marketplace + SaaS | Phòng khám đa khoa | Ngoại trú | Thanh toán trực tiếp và trực tuyến  
**Chủ sở hữu sản phẩm:** Product Owner — cần chỉ định  
**Trạng thái nguồn:** Xây dựng từ Phase 01 và các quyết định người dùng; chưa audit source/DB V1; các thông số chưa được chủ cơ sở xác nhận được gắn `[PROPOSED]` hoặc `[OPEN]`.

> **Quy tắc sử dụng:** Mọi dòng `[LOCKED]` là phạm vi người dùng đã xác nhận; `[PROPOSED]` là baseline đề xuất để review; `[OPEN]` là quyết định còn thiếu. Không tự chuyển `[PROPOSED]` thành yêu cầu pháp lý hoặc cam kết đã được cơ sở khám chữa bệnh phê duyệt.

## 1. Tóm tắt sản phẩm

Clinic Management V2 là nền tảng hai mặt: (A) marketplace công khai cho bệnh nhân tìm phòng khám đa khoa, bác sĩ, dịch vụ, thời gian còn trống và đặt lịch; (B) workspace SaaS để từng phòng khám quản lý chi nhánh, nhân sự, lịch, tiếp nhận, hàng đợi, khám ngoại trú, cận lâm sàng, kê đơn, thu phí, đối soát và theo dõi sau khám. Platform Console điều hành danh bạ, onboarding, thuê bao và nghiệp vụ nền tảng; không phải tài khoản quản trị y tế của từng phòng khám.

### 1.1 Mục tiêu

| ID | Mục tiêu đo được | Chỉ số đề xuất / cách kiểm chứng |
|---|---|---|
| GO-01 | Bệnh nhân hoàn thành đặt lịch từ web | Hoàn tất E2E với slot thực, có chống trùng, có xác nhận |
| GO-02 | Người đến trực tiếp được khám mà không cần booking | Walk-in E2E không bắt buộc tạo appointment |
| GO-03 | Phòng khám vận hành cả ngày trên cùng nguồn dữ liệu | Từ lịch -> tiếp nhận -> khám -> thu phí -> cuối ca, không nhập lặp vô lý |
| GO-04 | Không lộ dữ liệu giữa cơ sở | Bộ test cross-tenant read/write, role escalation và revoke đạt 100% |
| GO-05 | Hai hình thức thu tiền được đối soát | Clinic direct collection và platform online collection có sổ giao dịch, refund và settlement riêng |
| GO-06 | Hồ sơ khám có trách nhiệm chuyên môn | Draft, xác nhận điện tử, version/addendum, audit, công bố cho bệnh nhân đúng phạm vi |

### 1.2 Ngoài phạm vi bản phát hành P0

Nội trú, cấp cứu chuyên sâu, phẫu thuật, BHYT quyết toán/liên thông chính thức, telemedicine, HIS/LIS/PACS bên thứ ba, kho dược toàn diện, bán quảng cáo xếp hạng, chẩn đoán bằng AI, kết nối thiết bị y tế thực. Có thể chuẩn bị extension points nhưng không quảng bá là tính năng đã hoàn thành.

### 1.3 Bối cảnh và giới hạn

- `[LOCKED]` Marketplace + SaaS; phòng khám đa khoa; khám ngoại trú; thu trực tiếp lẫn online.
- `[PROPOSED]` Phòng khám có thể có nhiều chi nhánh; bác sĩ có thể làm việc cho nhiều cơ sở nhưng phân công/lịch/giá/quyền tách biệt.
- Chỉ công bố trên web thông tin phòng khám/bác sĩ/dịch vụ đã qua quy trình duyệt và có quyền công bố.
- Không xóa V1, không reset database. V2 triển khai song song với migration có đối soát và rollback.

## 2. Ranh giới sản phẩm và kênh truy cập

| Kênh | Đối tượng | Mục tiêu | Không được làm |
|---|---|---|---|
| Public Marketplace + Patient Portal | Khách, bệnh nhân, đại diện hợp pháp | Search, xem hồ sơ, đặt/hủy/đổi lịch, kết quả được công bố, thanh toán | Xem thông tin của bệnh nhân khác hoặc dữ liệu hành chính nội bộ |
| Clinic Workspace | Owner, manager, lễ tân, thu ngân, bác sĩ, điều dưỡng, cận lâm sàng được phân công | Vận hành phòng khám/chi nhánh; có active clinic context | Dùng một role chung để xem toàn bộ dữ liệu y tế |
| Platform Console | Platform ops/admin | Duyệt clinic, cấu hình gói SaaS, hoạt động marketplace, hỗ trợ thanh toán | Mặc nhiên xem hoặc sửa bệnh án của tenant |

**Ranh giới logic:** `platform_user` (định danh tài khoản) khác `clinic_membership` (quan hệ nhân sự + phạm vi chi nhánh) và khác `patient` (định danh người được khám). `clinic_id` và `branch_id` được thực thi tại API/data access, không dựa vào frontend filtering. Hồ sơ có cơ sở chủ quản và quy tắc chia sẻ hợp lệ; tài khoản bệnh nhân dùng chung không đồng nghĩa hồ sơ tự chia sẻ cho mọi clinic.

## 3. Vai trò, mục tiêu và trách nhiệm

| Vai trò | Công việc P0 | Ranh giới quyền |
|---|---|---|
| Platform Admin/Ops | Kiểm tra hồ sơ cơ sở, duyệt hiển thị, cấu hình gói, xử lý hỗ trợ và đối soát nền tảng | Không có quyền y khoa mặc định |
| Clinic Owner | Đăng ký cơ sở, cấu hình, phân quản lý, xem vận hành/tài chính | Không mặc nhiên truy cập nội dung bệnh án nếu không có nhiệm vụ |
| Clinic Manager | Cấu hình chi nhánh, nhân sự, chuyên khoa, bảng giá, lịch/phòng, báo cáo | Theo tenant/branch được giao |
| Receptionist | Đặt lịch tại quầy, walk-in, tìm/liên kết bệnh nhân, check-in, hàng đợi, điều phối | Chỉ trường hành chính liên quan |
| Cashier | Thu tiền, ghi nhận giao dịch, biên nhận, hoàn tiền theo duyệt, chốt ca | Không chỉnh sửa nội dung chuyên môn |
| Doctor | Danh sách khám được phân công, bệnh án, chỉ định, đánh giá kết quả, chẩn đoán, kê đơn, ký | Encounter/branch/quan hệ hợp lệ |
| Nurse | Sinh hiệu, hỗ trợ tiếp nhận và thao tác lâm sàng được giao | Không thay bác sĩ chẩn đoán/ký |
| Lab/Service staff | Nhận chỉ định, thực hiện và trả kết quả có phân công | Chỉ order và dữ liệu tối thiểu |
| Patient/Guardian | Đặt lịch, theo dõi, thanh toán, xem tài liệu công bố cho mình/người phụ thuộc hợp lệ | Quyền đại diện phải xác minh và thu hồi được |

Bảng quyền thao tác chi tiết nằm ở `Role_Permission_Matrix.md`. Một người có thể kiêm nhiều vai trò nhưng chỉ thực hiện hành động nếu từng quyền và phạm vi đối tượng đều hợp lệ; UI không phải lớp bảo vệ cuối.

## 4. Ưu tiên phát hành

- **P0 / MVP vận hành:** Onboard clinic, cấu hình chi nhánh/nhân sự/lịch/giá, marketplace & search, booking chống trùng, walk-in, check-in/queue, encounter ngoại trú, xét nghiệm nội bộ tối thiểu, kê đơn, ký/phiên bản hồ sơ, billing trực tiếp/online, patient portal, tenant authorization, audit, thông báo cơ bản, migration an toàn.
- **P1 / vận hành mở rộng:** Nghỉ phép/lịch phức tạp, quản lý tài nguyên phòng/thiết bị, hoàn tiền tự động, đối soát kỳ nâng cao, người phụ thuộc phức tạp, dashboard chuyên sâu, tích hợp lab/pharmacy thực, khuyến mãi, báo cáo hiệu suất.
- **P2 / tương lai:** Telehealth, BHYT/liên thông theo chuẩn tích hợp được phê duyệt, inventory/dược đầy đủ, phân tích nâng cao, AI hỗ trợ không quyết định chuyên môn.

Không được hạ P0 bảo mật, phân quyền, audit, backup hoặc xử lý thanh toán xuống P1 chỉ để phát hành nhanh.

## 5. Functional requirements — yêu cầu chức năng

**Quy ước:** FR-ID là định danh bền vững. Ưu tiên P0/P1; cột “Kiểm chứng” là điều kiện chấp nhận tối thiểu, test toàn tuyến chi tiết ở `Acceptance_Test_Matrix.md`.

### 5.1 Tổ chức, tenant, onboarding và cấu hình

| ID | P | Yêu cầu | Kiểm chứng tối thiểu |
|---|---|---|---|
| FR-ORG-01 | P0 | Owner đăng ký hồ sơ phòng khám, giấy phép/phạm vi hoạt động, người liên hệ | Không thể công bố khi thiếu hồ sơ bắt buộc |
| FR-ORG-02 | P0 | Platform review: draft/submitted/needs_changes/approved/rejected/suspended | Mỗi thay đổi có actor, lý do và thời điểm |
| FR-ORG-03 | P0 | Tenant có một hoặc nhiều branch với trạng thái hoạt động và giờ mở cửa | Mọi lịch/encounter/bill mang branch hợp lệ |
| FR-ORG-04 | P0 | Clinic quản lý chuyên khoa, dịch vụ, bảng giá theo clinic/branch | Giá đặt lịch hiển thị snapshot/version và thời điểm hiệu lực |
| FR-ORG-05 | P0 | Quản lý membership/invite/revoke và phân quyền có phạm vi | Quyền cũ bị thu hồi ngay, không lộ tenant khác |
| FR-ORG-06 | P0 | Bác sĩ có affiliation nhiều clinic/branch, chuyên môn và lịch riêng | Trùng tên bác sĩ không gộp phân công sai |
| FR-ORG-07 | P0 | Chỉ profile được duyệt mới vào public index | Tạm dừng cơ sở thì chặn đặt lịch mới, xử lý lịch cũ có thông báo |
| FR-ORG-08 | P1 | Quản lý thuê bao/gói SaaS, hạn mức và hóa đơn dịch vụ nền tảng | Không ảnh hưởng dữ liệu lâm sàng khi quá hạn; policy có phê duyệt |

### 5.2 Identity, patient và quyền truy cập

| ID | P | Yêu cầu | Kiểm chứng tối thiểu |
|---|---|---|---|
| FR-IAM-01 | P0 | Đăng ký, đăng nhập, reset, session/logout theo chính sách | Token/session revoked không dùng tiếp được |
| FR-IAM-02 | P0 | User có nhiều membership; chọn active clinic/branch ở workspace | API xác thực membership theo mỗi thao tác |
| FR-IAM-03 | P0 | Phân quyền vai trò + đối tượng + clinic/branch + assignment | IDOR/cross-tenant bị từ chối và ghi audit |
| FR-IAM-04 | P0 | Clinic patient link tách global identity khỏi hồ sơ cơ sở | Không thấy hồ sơ khám ở clinic khác chỉ vì cùng số điện thoại |
| FR-IAM-05 | P0 | Tìm/ghép hồ sơ trùng có xác minh, không tự merge mù | Có lịch sử hợp nhất và cơ chế review nhầm lẫn |
| FR-IAM-06 | P0 | Nhập bệnh nhân tại quầy không yêu cầu tài khoản web | Walk-in dùng temporary/contact profile được |
| FR-IAM-07 | P0 | Quản lý người đại diện/người phụ thuộc có xác minh quyền | Thu hồi đại diện chặn truy cập sau đó |
| FR-IAM-08 | P0 | Tối thiểu hóa dữ liệu hiển thị theo vai trò | Lễ tân/thu ngân không đọc chẩn đoán qua endpoint |

### 5.3 Public Marketplace và Patient Portal

| ID | P | Yêu cầu | Kiểm chứng tối thiểu |
|---|---|---|---|
| FR-PUB-01 | P0 | Tìm theo địa điểm, tên, chuyên khoa, dịch vụ, bác sĩ | Kết quả chỉ gồm hồ sơ public đã được duyệt |
| FR-PUB-02 | P0 | Trang clinic/branch: giấy phép hiển thị phù hợp, địa chỉ, giờ, chuyên khoa, dịch vụ/giá | Thông tin nguồn và ngày cập nhật rõ ràng |
| FR-PUB-03 | P0 | Hồ sơ bác sĩ đã duyệt: chuyên môn, nơi khám, lịch khả dụng | Không rò lịch nội bộ/chi nhánh không công bố |
| FR-PUB-04 | P0 | Chọn clinic > branch > dịch vụ/chuyên khoa > bác sĩ/khung giờ | Chỉ cho chọn slot còn khả dụng thực |
| FR-PUB-05 | P0 | Khách/bệnh nhân đăng ký đặt lịch, nhận thông báo xác nhận | Booking liên kết đúng patient identity |
| FR-PUB-06 | P0 | Lịch của tôi: xem, hủy/đổi theo policy, theo dõi trạng thái | Lịch hủy không còn chiếm slot trừ chính sách giữ rõ ràng |
| FR-PUB-07 | P0 | Patient portal xem tài liệu được công bố: đơn, kết quả, hướng dẫn, biên nhận | Không lộ draft, tài liệu nội bộ, tenant khác |
| FR-PUB-08 | P0 | Thể hiện trạng thái và lịch sử thanh toán/refund của mình | Mã hóa/sanitize chi tiết giao dịch nhạy cảm |
| FR-PUB-09 | P1 | Ưu tiên/bộ lọc nâng cao, người thân phức tạp, đánh giá cơ sở có kiểm duyệt | Không biến quảng cáo thành xếp hạng lâm sàng sai lệch |

### 5.4 Appointment, slot, check-in và hàng đợi

| ID | P | Yêu cầu | Kiểm chứng tối thiểu |
|---|---|---|---|
| FR-SCH-01 | P0 | Lịch bác sĩ theo branch, ca, nghỉ, năng lực phục vụ | Slot phản ánh lịch hoạt động hiện thời |
| FR-SCH-02 | P0 | Giữ slot tạm với TTL và mã idempotency | Hai phiên đặt cùng 1 capacity không cùng thành công |
| FR-SCH-03 | P0 | Booking có pending/confirmed/canceled/rescheduled/no_show/checked_in | Mỗi transition kiểm tra actor + điều kiện |
| FR-SCH-04 | P0 | Bảo toàn slot khi thanh toán chậm, thành công/timeout hoặc hủy | Không tạo booking ma sau webhook đến muộn |
| FR-SCH-05 | P0 | Lễ tân đặt hộ, thay đổi/điều phối lịch với audit | Bệnh nhân được thông báo thay đổi |
| FR-SCH-06 | P0 | Walk-in tạo Encounter không bắt buộc Appointment | Bác sĩ thấy lượt khám trong đúng hàng đợi |
| FR-SCH-07 | P0 | Check-in xác minh bệnh nhân và chống check-in hai lần | Một lượt khám không có hai phiếu queue đang hoạt động |
| FR-SCH-08 | P0 | Queue ticket theo branch/ngày/điểm phục vụ, gọi/bỏ qua/chuyển | Không hiển thị lẫn clinic/branch khác |
| FR-SCH-09 | P0 | Bác sĩ vắng/no-show/đến muộn: phân luồng xử lý có lý do | Không âm thầm mất lịch/tiền đã thu |
| FR-SCH-10 | P1 | Hỗ trợ phòng/thiết bị và capacity đa slot | Không quá tải tài nguyên chia sẻ |

### 5.5 Khám ngoại trú và hồ sơ y tế

| ID | P | Yêu cầu | Kiểm chứng tối thiểu |
|---|---|---|---|
| FR-MED-01 | P0 | Encounter riêng appointment, có source booking/walk-in và clinic/branch | Mỗi lượt có mã, owner, trạng thái, timeline |
| FR-MED-02 | P0 | Doctor nhận lượt theo assignment, bắt đầu/kết thúc khám | Doctor ngoài phạm vi không mở hồ sơ |
| FR-MED-03 | P0 | Thu thập lý do khám, tiền sử, dị ứng, sinh hiệu, khám lâm sàng | Lưu draft và validation dữ liệu phù hợp |
| FR-MED-04 | P0 | Bác sĩ nhập chẩn đoán sơ bộ/kết luận, hướng dẫn, hẹn tái khám | Kết quả gắn đúng encounter và tác giả |
| FR-MED-05 | P0 | Tạo chỉ định dịch vụ/xét nghiệm với trạng thái riêng | Order không bị coi đã hoàn thành khi mới được tạo |
| FR-MED-06 | P0 | Nhân sự được phân quyền nhận order, nhập/trả kết quả | Result có tác giả, nguồn và thời điểm |
| FR-MED-07 | P0 | Bác sĩ review kết quả và hoàn thiện kết luận | Encounter đang chờ kết quả không tự kết thúc cuối ngày |
| FR-MED-08 | P0 | Kê đơn: thuốc, hoạt chất/hàm lượng khi áp dụng, liều, đường dùng, tần suất, thời gian, dặn dò | Không cho ký nếu thiếu trường bắt buộc theo biểu mẫu đã chốt |
| FR-MED-09 | P0 | Tài liệu bản nháp, xác nhận/ký điện tử phù hợp, version và addendum | Bản đã ký không ghi đè âm thầm; mọi chỉnh sửa truy vết |
| FR-MED-10 | P0 | Phân tách đóng chuyên môn, đóng encounter, thu phí và xuất bản portal | Thanh toán không thể tự ký bệnh án |
| FR-MED-11 | P0 | Xuất/hiển thị/khôi phục bệnh án và dữ liệu bắt buộc | QA với biểu mẫu và checklist pháp lý được duyệt |
| FR-MED-12 | P1 | Tích hợp LIS/PACS, dược, biểu mẫu chuyên khoa nâng cao | Contract/consent và dữ liệu nguồn rõ ràng |

### 5.6 Billing và thanh toán hybrid

| ID | P | Yêu cầu | Kiểm chứng tối thiểu |
|---|---|---|---|
| FR-BIL-01 | P0 | Charge sinh từ booking/khám/dịch vụ thực, có nguồn và giá snapshot | Không tạo khoản phí chỉ từ giá UI |
| FR-BIL-02 | P0 | Bill tổng hợp line item, giảm/miễn/điều chỉnh với lý do và người duyệt | Tiền phải thu = tổng khoản hợp lệ - giảm/đã thu/hoàn theo mô hình rõ |
| FR-BIL-03 | P0 | Thu trực tiếp tiền mặt/chuyển khoản/POS với người thu/ca thu | Payment event không sửa lịch sử số tiền |
| FR-BIL-04 | P0 | Thanh toán online qua payment provider/gateway được tích hợp | Verify webhook signature, order, amount, currency, merchant và idempotency |
| FR-BIL-05 | P0 | Phân biệt người thụ hưởng/pháp nhân: clinic nhận trực tiếp hoặc nền tảng nhận hộ | Ledger, settlement và report không gộp dòng tiền |
| FR-BIL-06 | P0 | Tiền đặt cọc được khấu trừ bill cuối hoặc xử lý theo policy | Không thu hai lần cùng khoản |
| FR-BIL-07 | P0 | Partial payment, số dư còn lại và trạng thái công nợ | Hai giao dịch đồng thời không khiến overpayment im lặng |
| FR-BIL-08 | P0 | Refund/cancel/void với phê duyệt, lý do, trạng thái và link original payment | Refund replay không hoàn hai lần |
| FR-BIL-09 | P0 | Biên nhận/chứng từ và dữ liệu phục vụ hóa đơn theo quy trình pháp lý được duyệt | Biên nhận nội bộ không bị gắn nhãn hóa đơn thuế khi chưa tích hợp |
| FR-BIL-10 | P0 | Chốt ca và đối soát tiền trực tiếp/online, phát hiện lệch | Có variance, người xác nhận và audit trail |
| FR-BIL-11 | P0 | Webhook đến muộn, callback lặp, provider timeout có reconcile job | Giao dịch không bị mất hoặc tự gán thành công sai |
| FR-BIL-12 | P1 | Settlement định kỳ tự động, split fee/phí nền tảng và export kế toán nâng cao | Số tổng settlement khớp event gốc |

### 5.7 Notification, báo cáo và audit

| ID | P | Yêu cầu | Kiểm chứng tối thiểu |
|---|---|---|---|
| FR-OPS-01 | P0 | Thông báo booking, thay lịch, nhắc hẹn, kết quả công bố, payment/refund | Có queue/retry/dedup và trạng thái gửi |
| FR-OPS-02 | P0 | Nội dung SMS/push/email tối thiểu, không lộ chi tiết y tế nhạy cảm | Template review được; preference được tôn trọng |
| FR-OPS-03 | P0 | Dashboard theo role/branch với số liệu có nguồn | Receptionist/Doctor chỉ thấy phạm vi phụ trách |
| FR-OPS-04 | P0 | Audit security + clinical + billing + admin | Actor, action, object, clinic/branch, timestamp, outcome, reason |
| FR-OPS-05 | P0 | Export và sao lưu/khôi phục có kiểm tra | Có báo cáo restore drill và kiểm tra toàn vẹn |
| FR-OPS-06 | P0 | Khi clinic bị suspend, xử lý lịch/tiền/hồ sơ đang tồn tại theo policy | Không làm mất quyền truy cập hợp pháp của người bệnh |
| FR-OPS-07 | P1 | Dashboard phân tích nâng cao, SLA analytics | Dữ liệu tổng hợp không làm lộ dữ liệu cá nhân không cần thiết |

## 6. Vòng đời nghiệp vụ chính

### 6.1 Tách các thực thể

| Thực thể | Ý nghĩa | Có thể tồn tại không có đối tượng nào? |
|---|---|---|
| SlotHold | Giữ chỗ tạm cho booking | Chưa có Appointment |
| Appointment | Ý định và cam kết lịch đến khám | Chưa có Encounter |
| QueueTicket | Vị trí phục vụ của một lượt đến | Tồn tại cho walk-in hoặc booking |
| Encounter | Lượt khám thực tế tại cơ sở | Có thể không có Appointment (walk-in) |
| ClinicalDocument | Tài liệu bệnh án và phiên bản xác nhận | Thuộc Encounter/nguồn chuyên môn |
| ClinicalOrder/Result | Y lệnh/kết quả cận lâm sàng | Có lifecycle độc lập |
| Charge/Bill | Nghĩa vụ tài chính phát sinh | Có thể chưa có Payment |
| Payment/Refund/Settlement | Giao dịch nhận/hoàn/phân bổ tiền | Không đồng nghĩa dịch vụ đã hoàn thành |

### 6.2 State machines baseline `[PROPOSED]`

- **Onboarding:** draft -> submitted -> needs_changes -> submitted -> approved -> published; rejected/suspended/unpublished có transition được cấp quyền.
- **SlotHold:** active -> consumed/expired/released; một hold chỉ được consume một lần.
- **Appointment:** pending -> confirmed -> checked_in -> fulfilled; nhánh canceled, rescheduled, no_show. `fulfilled` chỉ phản ánh lịch đến khám, không tự xác nhận hồ sơ.
- **Queue:** waiting -> called -> serving -> done; nhánh skipped/transferred/canceled có actor + reason.
- **Encounter:** waiting -> in_progress -> awaiting_results -> in_progress -> clinically_completed -> closed; interrupted/transfer/canceled cần lý do. Signature gắn tài liệu, không suy ra từ `closed`.
- **ClinicalOrder:** ordered -> accepted -> processing -> resulted -> reviewed; canceled/rejected có reason. Kết quả trả về không tự đánh dấu bác sĩ đã review.
- **Bill:** draft -> issued -> partially_paid -> paid; disputed/voided/adjusted theo kiểm soát. Refund là sự kiện tài chính chứ không đảo ngược lịch sử payment.
- **Payment:** initiated -> pending -> succeeded/failed/canceled; reconcile unknown; webhook lặp không sinh thêm sự kiện thành công.

## 7. Quy tắc nghiệp vụ xuyên hệ thống

| ID | Quy tắc bắt buộc | Hệ quả kiểm thử |
|---|---|---|
| BR-01 | Appointment khác Encounter; walk-in không bắt buộc appointment | Walk-in E2E |
| BR-02 | Clinic và branch có quan hệ sở hữu xác thực, không nhận clinic_id client một cách mù quáng | Tenant escape test |
| BR-03 | Patient global không tự cho phép clinic B đọc hồ sơ clinic A | Cross-tenant medical test |
| BR-04 | Một staff có thể thuộc nhiều clinic; quyền áp dụng theo membership hiện hành | Switch/revoke test |
| BR-05 | Slot availability lấy từ lịch, nghỉ, capacity, holds và booking thực | Concurrent booking test |
| BR-06 | Hold slot có TTL, khóa/idempotency và cleanup | Timeout/race test |
| BR-07 | Hủy/đổi lịch luôn đánh giá payment/deposit/notification | Cancel with deposit test |
| BR-08 | Check-in chỉ một lần cho lượt đến; queue có mã nội bộ riêng | Duplicate check-in test |
| BR-09 | Chỉ người được phân công với quyền hợp lệ cập nhật hồ sơ | Assignment test |
| BR-10 | Tài liệu ký không ghi đè; bổ sung bằng version/addendum | Signed edit test |
| BR-11 | Kết quả xét nghiệm phải được người có trách nhiệm review trước kết luận cuối | Result review test |
| BR-12 | Bill lấy charge thực tế và giá snapshot, không tính lại giá cũ khi catalog đổi | Price change test |
| BR-13 | Thu trực tiếp và thu hộ nền tảng có ledger và chủ thể nhận tiền riêng | Settlement test |
| BR-14 | Mọi callback thanh toán xác minh và idempotent | Replay/forged webhook test |
| BR-15 | Refund dẫn chiếu payment gốc và điều kiện phê duyệt | Double refund test |
| BR-16 | Cuối ngày không tự hoàn tất encounter đang chờ kết quả | Overnight pending test |
| BR-17 | Portal chỉ công bố tài liệu approved/released, không hiển thị draft | Release test |
| BR-18 | Notification không mang nội dung sức khỏe chi tiết khi kênh không an toàn | Template leakage test |
| BR-19 | Thao tác nhạy cảm phải có audit không sửa/xóa tùy tiện | Audit integrity test |
| BR-20 | Mã hiển thị không làm khóa quan hệ giữa microservices | Referential linkage test |
| BR-21 | Số tiền VND dùng số nguyên đơn vị đồng; chính sách làm tròn theo hợp đồng | Financial precision test |
| BR-22 | Ngày/giờ lịch khám theo Asia/Ho_Chi_Minh hoặc zone của branch đã cấu hình, thời điểm hệ thống lưu UTC | Time boundary test |
| BR-23 | `clinically_completed`, `bill paid`, `appointment fulfilled`, `document signed` là các trạng thái độc lập | Cross-status test |
| BR-24 | Chuyển clinic/branch không đồng nghĩa chuyển hồ sơ y tế, phải có cơ chế chia sẻ hợp lệ | Transfer privacy test |
| BR-25 | Khi lỗi một service, thao tác không được tự báo thành công; dùng retry/outbox/idempotency | Partial failure test |

## 8. Non-functional requirements và dữ liệu

| ID | Mức | Yêu cầu / tiêu chí nghiệm thu |
|---|---|---|
| NFR-01 | P0 | 100% API đọc/ghi dữ liệu tenant cần tenant scope, record scope và authorization tests |
| NFR-02 | P0 | TLS khi truyền, mã hóa backup và dữ liệu nhạy cảm thích hợp khi lưu, quản lý secrets ngoài source |
| NFR-03 | P0 | Audit actor/action/object/scope/time/outcome cho nghiệp vụ y tế, tài chính, phân quyền |
| NFR-04 | P0 | Healthcheck, structured logs, correlation/trace ID xuyên services, cảnh báo queue/webhook failure |
| NFR-05 | P0 | Backup có kiểm thử restore; RPO/RTO phải được phê duyệt trước production; `[PROPOSED]` RPO <=15 phút, RTO <=4 giờ |
| NFR-06 | P0 | `[PROPOSED]` p95 public search <=2.5s; p95 appointment action <=2s ở tải đã chốt; đo trên test staging, không cam kết nếu chưa benchmark |
| NFR-07 | P0 | Payment exact-once *effect* qua idempotency và ledger; không hứa hệ thống phân tán xử lý đúng một lần ở tầng truyền tải |
| NFR-08 | P0 | Không mất sự kiện giữa DB commit và message publish: outbox/inbox hoặc giải pháp tương đương |
| NFR-09 | P0 | Ký/xác nhận, lưu trữ và truy xuất bệnh án đáp ứng checklist cơ sở đã phê duyệt, có test khôi phục |
| NFR-10 | P0 | Giao diện responsive trên desktop/tablet/mobile; text/hành động trọng yếu không che khuất |
| NFR-11 | P0 | UI tiếng Việt, định dạng VND, ngày tháng, giờ và thông báo lỗi có thể hành động |
| NFR-12 | P0 | Dữ liệu bệnh án thật không dùng ở staging/demo khi chưa có căn cứ và biện pháp phù hợp |
| NFR-13 | P1 | WCAG 2.2 AA làm mục tiêu thiết kế khi khả thi; keyboard, contrast, label và error announcement kiểm thử |
| NFR-14 | P0 | Không xóa/ghi đè dữ liệu V1 khi migration; dry-run, reconciliation, rollback có bằng chứng |

**Dữ liệu lõi dự kiến:** Clinic, Branch, ClinicLicense, StaffMembership, DoctorAffiliation, Schedule, CatalogOffering, PriceVersion, PlatformUser, PatientIdentity, ClinicPatientLink, SlotHold, Appointment, QueueTicket, Encounter, ClinicalDocumentVersion, ClinicalOrder, Result, Prescription, Charge, Bill, Payment, Refund, Settlement, Notification, AuditEvent. Đây là conceptual domain model, **chưa phải ERD và không áp đặt một database chung cho mọi service**.

## 9. Tích hợp giữa các service — định hướng hợp đồng

| Bounded context | Nguồn sự thật | Sự kiện/contract dự kiến |
|---|---|---|
| Identity | user, session, membership, authorization | StaffMembershipChanged |
| Clinic | clinic/branch/license/publication | ClinicApproved, BranchUpdated |
| Doctor | affiliation, schedule, availability | DoctorScheduleUpdated |
| Patient | identity và clinic link | PatientLinkedToClinic |
| Appointment | hold, booking, check-in/queue (ownership cụ thể xác nhận ở thiết kế) | AppointmentConfirmed, AppointmentCanceled, PatientCheckedIn |
| Medical | encounter, document, order/result/prescription | EncounterStarted, ClinicalOrderCreated, ClinicalDocumentReleased |
| Catalog | dịch vụ, giá hiệu lực | OfferingPublished, PriceChanged |
| Billing | charge, bill, payment ledger, refund/settlement | ChargeCreated, PaymentSucceeded, RefundSettled |
| Notification | template, preference, delivery state | NotificationRequested, DeliveryFailed |
| Search read model | chỉ dữ liệu public denormalized | nhận sự kiện Clinic/Doctor/Catalog/Appointment; không giữ dữ liệu bệnh án |

Read model public phải có eventual consistency minh bạch; thao tác đặt chỗ **luôn xác nhận với service sở hữu slot** thay vì coi search index là nguồn chân lý. Chưa quyết định event bus, DB engine, API protocol hay deployment trong PRD này.

## 10. UX và thông tin bắt buộc trên màn hình

| Màn hình | Phải hiển thị/cho phép |
|---|---|
| Marketplace Home/Search | Search + lọc + trạng thái cơ sở + dữ liệu đã xác minh |
| Clinic Detail | Branch, địa chỉ, chuyên khoa, bác sĩ, dịch vụ/giá/khung giờ khả dụng |
| Booking | Chọn đối tượng được khám, branch/service/doctor/slot, chính sách tiền, xác nhận, mã lịch |
| Patient Portal | Lịch của tôi, hóa đơn/biên nhận, hồ sơ được công bố, đại diện/người phụ thuộc |
| Clinic Admin | Clinic/branch setup, giấy phép, nhân viên, ca làm, danh mục/giá, dashboard theo branch |
| Reception Desk | Today list, walk-in, tìm patient, check-in, queue, exception/reschedule; ít scroll ngang/dọc vô ích |
| Doctor Worklist | Hàng đợi được phân công, thông tin cần biết, encounter, chỉ định/kết quả/kê đơn, nút xác nhận |
| Cashier | Khoản thu, đặt cọc, số đã thu/còn lại, hai luồng online/offline, refund, chốt ca |
| Platform Console | Onboarding review, publication, SaaS, support, settlement monitoring, audit security |

Tất cả màn hình có empty/loading/error/permission/partial failure states; mã bệnh nhân, lịch, lượt khám và queue ticket phải có nhãn phân biệt, không ghép chuỗi gây nhầm lẫn.

## 11. Tiêu chí nghiệm thu cấp phát hành

**GATE-A: Chức năng E2E.** Online booking và walk-in hoàn thành từ đầu đến cuối; doctor review result, ký, patient xem tài liệu; thu trực tiếp và online, có refund/settlement test.

**GATE-B: Bảo mật.** Tất cả tình huống cross-tenant read/write, IDOR, revoked membership, patient guardian and staff scoping trong matrix phải đạt; không còn lỗi mức nghiêm trọng chưa xử lý.

**GATE-C: Tiền.** Concurrent double-book, duplicate webhook, timeout, charge duplicate, partial payment, refund replay và reconcile đạt; ledger đối soát được.

**GATE-D: Bệnh án.** Workflow bắt buộc được người phụ trách chuyên môn duyệt; ký/xác nhận, phiên bản, export/retrieval và restore được kiểm chứng; không coi lưu PostgreSQL là đủ điều kiện EMR.

**GATE-E: Vận hành.** Backup/restore drill; migration rehearsal với đối chiếu số bản ghi và tổng tiền; rollback và cảnh báo; các quyết định OPEN liên quan pháp lý/thanh toán đều phải chốt.

Test IDs và Given/When/Then chi tiết: `Acceptance_Test_Matrix.md`. Không dùng dấu tick thủ công thay cho kết quả test có evidence.

## 12. Lộ trình triển khai theo vertical slices

| Slice | Phạm vi E2E | Điều kiện kết thúc |
|---|---|---|
| S0 — Foundation | Tenant, IAM, clinic onboarding, audit, backup, role/branch scope | Không có cross-tenant escape |
| S1 — Discovery/Booking | Public clinic search, doctor, catalog, schedule, slot hold, confirmation | Concurrent slot/cancel E2E đạt |
| S2 — Front Desk | Walk-in, patient linkage, check-in, queue, doctor list | Không đặt qua web vẫn khám được |
| S3 — Care | Encounter, clinical note, orders/results, prescription, sign/release | Clinical E2E + authorization đạt |
| S4 — Revenue | Charge/bill, clinic direct collection, platform online collection, refund, reconcile | Tất cả ledger test đạt |
| S5 — Patient & Cutover | Portal, notification, migration, end-of-day, observability | Hai E2E chuẩn, security/compliance gates đạt |

**Đối với source V1:** reuse/refactor/replace là kết quả audit, không đoán theo tên service. Mọi schema change có migration dry-run, backup, mapping, rollback, và kiểm chứng khóa quan hệ. Frontend V1 chỉ loại bỏ sau khi luồng tương đương V2 vượt nghiệm thu.

## 13. Các quyết định mở cần ký duyệt trước thiết kế chi tiết

| ID | Câu hỏi | Baseline đề xuất | Quyết định thuộc về |
|---|---|---|---|
| OD-01 | Ai là merchant/đơn vị thụ hưởng khi platform thu online? | Hai model ledger; không mặc định quyền nhận hộ | Pháp chế + tài chính + PO |
| OD-02 | Có bắt buộc đặt cọc khi booking? | Theo policy từng clinic/service | PO + clinic |
| OD-03 | Chính sách no-show, đổi lịch, hoàn tiền? | Configurable với mốc thời gian/lý do | PO + clinic + tài chính |
| OD-04 | Bệnh nhân được chọn bác sĩ hay hệ thống phân? | Cho clinic cấu hình, có fallback chuyên khoa | Clinic ops |
| OD-05 | Ngưỡng/mẫu trường bắt buộc từng bệnh án ngoại trú? | Từ mẫu hiện hành do chuyên môn duyệt | Medical lead + compliance |
| OD-06 | Cơ sở/chi nhánh chia sẻ hồ sơ như thế nào? | Deny-by-default; có căn cứ và audit | Medical lead + pháp chế |
| OD-07 | Phòng xét nghiệm/nhà thuốc nội bộ hay đối tác? | P0 nhập kết quả nội bộ, tích hợp ngoài P1 | Clinic ops |
| OD-08 | Phạm vi chứng từ tài chính/hóa đơn điện tử? | Biên nhận nội bộ P0, pháp lý hóa đơn được đối chiếu riêng | Kế toán + pháp chế |
| OD-09 | SLO/SLA và tải mục tiêu production? | Benchmark trước khi duyệt con số | PO + Tech lead |
| OD-10 | Patient identity matching, người giám hộ, quyền rút lại? | Xác minh trước liên kết; không tự merge | Privacy + clinic |

`Decision_Log.md` theo dõi owner, deadline và trạng thái. Không biến lựa chọn baseline thành quyết định đã chốt.

## 14. Đối chiếu pháp lý và điều kiện go-live

Tài liệu sản phẩm này **không phải ý kiến pháp lý**. Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 và Nghị định 356/2025/NĐ-CP có hiệu lực từ 01/01/2026; Thông tư 13/2025/TT-BYT hướng dẫn triển khai hồ sơ bệnh án điện tử có hiệu lực từ 21/07/2025. Theo Điều 4 của thông tư, nhóm cơ sở khám chữa bệnh khác bệnh viện có điều trị nội trú, ban ngày và ngoại trú nằm trong lộ trình hoàn thành chậm nhất 31/12/2026; cần xác định cơ sở/phạm vi áp dụng cụ thể khi go-live. Việc lập/cập nhật bệnh án phải đối chiếu nội dung Chương X Thông tư 32/2023/TT-BYT và các văn bản sửa đổi còn hiệu lực. Phạm vi giấy phép phòng khám đa khoa cần đối chiếu Nghị định 96/2023/NĐ-CP và văn bản sửa đổi. Chứng từ/hóa đơn phải đối chiếu pháp luật thuế/hóa đơn hiện hành, không suy ra rằng nút 'In hóa đơn' trong SaaS là hóa đơn điện tử hợp pháp.

**Nguồn tham chiếu chính thức (đã kiểm tra ngày 29/09/2026):**
1. Luật 91/2025/QH15: https://vbpl.vn/tw/Pages/vbpq-thuoctinh.aspx?ItemID=179252
2. Nghị định 356/2025/NĐ-CP: https://vbpl.vn/TW/Pages/vbpq-toanvan.aspx?ItemID=187276
3. Thông tư 13/2025/TT-BYT: https://vbpl.vn/boyte/Pages/vbpq-toanvan.aspx?ItemID=178219
4. Luật Khám bệnh, chữa bệnh 15/2023/QH15: https://vbpl.vn/thaibinh/Pages/vbpq-toanvan.aspx?ItemID=168125
5. Thông tư 32/2023/TT-BYT (được sửa đổi một phần): https://vbpl.vn/boyte/Pages/vbpq-thuoctinh.aspx?ItemID=167907
6. Nghị định 96/2023/NĐ-CP (được sửa đổi một phần): https://vbpl.vn/haiduong/Pages/vbpq-toanvan.aspx?ItemID=168128
7. Nghị định 70/2025/NĐ-CP sửa đổi quy định về hóa đơn/chứng từ: https://vbpl.vn/TW/Pages/vbpq-thuoctinh.aspx?ItemID=177581

## 15. Phê duyệt tài liệu

| Vai trò duyệt | Phần phải kiểm tra | Tình trạng |
|---|---|---|
| Product Owner | Phạm vi, ưu tiên, go/no-go | Chưa ký duyệt |
| Đại diện phòng khám | Quy trình lễ tân, bác sĩ, chốt ca | Chưa xác minh thực địa |
| Medical Lead | Biểu mẫu, ký, y lệnh, kê đơn | Chưa ký duyệt |
| Finance/Accounting | Thu hộ, đối soát, chứng từ, hoàn tiền | Chưa ký duyệt |
| Privacy/Legal | Căn cứ xử lý dữ liệu, EMR, chia sẻ hồ sơ | Chưa ký duyệt |
| Tech Lead/QA | Tính kiểm thử được, migration, security, NFR | Chưa audit V1 |

**Definition of Ready để chuyển Phase 03:** OD-01, OD-05, OD-06, OD-08 được chốt; sign-off nhóm nghiệp vụ; toàn bộ yêu cầu P0 có owner và acceptance ID; audit V1 có bằng chứng; không còn mâu thuẫn trạng thái/nguồn sự thật dữ liệu.
