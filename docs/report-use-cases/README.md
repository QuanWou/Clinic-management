# Gợi ý sơ đồ use case cho báo cáo Clinic Management

Ngày đối chiếu mã nguồn: 07/10/2026. Phạm vi: mã nguồn hiện tại trong workspace, gồm cả thay đổi chưa commit. Đây là phân tích chức năng để viết báo cáo, chưa phải kết quả kiểm thử hệ thống đang chạy.

## 1. Kết luận về phạm vi

Tên biên hệ thống: **Hệ thống quản lý phòng khám**. Website bệnh nhân và workspace nhân viên nằm trong cùng biên. Năm service core, API Gateway, PostgreSQL, JWT và cơ chế đồng bộ là thành phần triển khai bên trong; không biểu diễn chúng thành actor ở sơ đồ nghiệp vụ tổng quát.

Dự án phục vụ một phòng khám trên giao diện hiện tại; dữ liệu và phân quyền vẫn có ngữ cảnh phòng khám/chi nhánh. Có thêm chức năng kiểm duyệt nền tảng, nên trình bày riêng nếu báo cáo bao gồm phần này.

## 2. Tác nhân

| Tác nhân | Mã / căn cứ | Vai trò trong sơ đồ |
|---|---|---|
| Khách truy cập | API public, chưa đăng nhập | Xem phòng khám, bác sĩ, chuyên khoa, dịch vụ, giá/lịch trống; đăng ký |
| Bệnh nhân | Tài khoản và ánh xạ bệnh nhân của chính người dùng | Hồ sơ cá nhân, lịch hẹn, lịch sử khám, kết quả, hóa đơn, thanh toán, thông báo |
| Nhân viên (lễ tân / thu ngân) | STAFF | Tiếp nhận, hàng đợi, đổi lịch tại quầy, lập phiếu, thu tiền, chốt ca |
| Bác sĩ | DOCTOR | Khám, hồ sơ, chỉ định, xử lý và duyệt kết quả xét nghiệm, hoàn tất lượt khám |
| Quản trị phòng khám | ADMIN | Cấu hình phòng khám, nhân sự, phân quyền, lịch làm việc, dịch vụ/giá, vận hành/tài chính/nhật ký |
| Cổng thanh toán | payOS / VNPAY | Tạo/xử lý thanh toán online, trả kết quả giao dịch được máy chủ xác minh |
| Quản trị nền tảng (tùy phạm vi) | platformOperator | Kiểm duyệt và quản lý trạng thái công khai của phòng khám |

**Phân biệt mô hình hiện tại với tài liệu cũ:** MembershipRole chỉ còn ADMIN, STAFF, DOCTOR. Migration V2 đã gộp chủ/quản lý thành ADMIN, lễ tân/thu ngân thành STAFF, LAB thành DOCTOR và thu hồi membership điều dưỡng cũ. Bệnh nhân không phải membership nhân sự. platformOperator là cờ quyền riêng, không phải ADMIN phòng khám.

Nếu muốn tách “Lễ tân” và “Thu ngân” thành hai actor trong báo cáo, ghi rõ đây là hai vai trò nghiệp vụ cùng được triển khai bằng STAFF. Không mô tả chúng như hai nhóm quyền tách biệt đã có trong hệ thống. Tương tự, không đưa kỹ thuật viên xét nghiệm độc lập vào mô hình hiện trạng.

## 3. Bộ sơ đồ đề xuất

| Hình | Nội dung | File |
|---|---|---|
| 1 | Tổng quát; actor và nhóm chức năng | [01-tong-quat.puml](01-tong-quat.puml), [hình SVG](01-tong-quat.svg) |
| 2 | Cổng bệnh nhân; đặt/đổi/hủy/tái khám và lịch sử | [02-benh-nhan.puml](02-benh-nhan.puml) |
| 3 | Tiếp nhận; bệnh nhân có hẹn/đến trực tiếp, hàng đợi | [03-tiep-nhan.puml](03-tiep-nhan.puml) |
| 4 | Khám; hồ sơ, chỉ định, kết quả và hoàn tất | [04-kham-xet-nghiem.puml](04-kham-xet-nghiem.puml) |
| 5 | Phiếu thu, tiền tại quầy, online và ca thu | [05-thu-phi.puml](05-thu-phi.puml) |
| 6 | Cấu hình, nhân sự, phân quyền và giám sát | [06-quan-tri.puml](06-quan-tri.puml) |
| Bổ sung | Kiểm duyệt nền tảng | [07-kiem-duyet-tuy-chon.puml](07-kiem-duyet-tuy-chon.puml) |

Hình tổng quát gom các mục tiêu cùng nhóm để dễ đọc. Các hình chi tiết bổ sung thao tác và điều kiện; không cố nhét tất cả use case vào một trang.

## 4. Danh mục use case để đánh số trong báo cáo

| Nhóm | Use case đề xuất |
|---|---|
| Chung | UC01 Đăng ký; UC02 Đăng nhập/đăng xuất; UC03 Tra cứu thông tin và lịch trống |
| Bệnh nhân | UC04 Cập nhật hồ sơ cá nhân; UC05 Đặt lịch khám; UC06 Xem lịch hẹn; UC07 Đổi lịch; UC08 Hủy lịch; UC09 Đặt lịch tái khám; UC10 Xem hồ sơ khám/kết quả; UC11 Xem hóa đơn/biên nhận; UC12 Thanh toán hóa đơn online; UC13 Xem hướng dẫn QR; UC14 Xem thông báo/cấu hình nhắc lịch |
| Tiếp nhận | UC15 Tra cứu/xác minh bệnh nhân; UC16 Tạo hồ sơ bệnh nhân đến trực tiếp; UC17 Tiếp nhận bệnh nhân có lịch; UC18 Tiếp nhận bệnh nhân đến trực tiếp; UC19 Quản lý hàng đợi; UC20 Đổi lịch tại quầy; UC21 Xử lý ngoại lệ/yêu cầu tiếp nhận |
| Khám | UC22 Xem danh sách khám được phân công; UC23 Bắt đầu khám; UC24 Ghi hồ sơ khám; UC25 Chỉ định xét nghiệm; UC26 Xử lý chỉ định; UC27 Ghi kết quả; UC28 Duyệt kết quả; UC29 Chờ kết quả/đưa lại hàng đợi; UC30 Xác nhận hồ sơ; UC31 Hoàn tất lượt khám; UC32 Đóng lượt khám |
| Thu phí | UC33 Xem lượt đủ điều kiện lập phiếu; UC34 Lập phiếu thu; UC35 Mở ca thu; UC36 Ghi nhận thu tiền; UC37 Xem/in biên nhận; UC38 Chốt ca thu; UC39 Giảm trừ hóa đơn; UC40 Duyệt ca thu |
| Quản trị | UC41 Quản lý phòng khám/chi nhánh; UC42 Quản lý tài khoản nhân viên; UC43 Phân quyền; UC44 Quản lý bác sĩ/lịch làm việc/khoảng vắng; UC45 Quản lý chuyên khoa/dịch vụ/bảng giá; UC46 Cấu hình điểm phục vụ; UC47 Xem vận hành; UC48 Xem tài chính/đối soát; UC49 Xử lý ngoại lệ/thử lại đồng bộ; UC50 Xem nhật ký |
| Nền tảng, tùy chọn | UC51 Gửi hồ sơ kiểm duyệt; UC52 Xem hồ sơ kiểm duyệt; UC53 Quyết định kiểm duyệt; UC54 Quản lý trạng thái công khai |

UC39, UC40 thuộc ADMIN; UC34–UC38 thuộc STAFF. ADMIN hiện không tự có quyền thu tiền hoặc khám.

## 5. Cách vẽ quan hệ đúng

- Actor ở ngoài biên; use case là hình elip nằm trong biên; actor nối use case bằng đường liền.
- include: chức năng bắt buộc được dùng trong use case gốc; mũi tên nét đứt từ use case gốc đến use case được dùng.
- extend: hành vi bổ sung ở một điều kiện/điểm mở rộng; mũi tên từ use case mở rộng đến use case gốc. Chỉ thêm nếu mô tả được điều kiện và điểm mở rộng.
- Không dùng mũi tên use case để biểu diễn thứ tự thời gian. Luồng “đặt lịch → tiếp nhận → khám → thanh toán” phù hợp với activity diagram.
- Đăng nhập thường là tiền điều kiện của use case được bảo vệ. Không cần nối include Đăng nhập vào mọi chức năng.
- Không mặc nhiên cho ADMIN kế thừa STAFF/DOCTOR: quyền hiện tại không có quan hệ bao hàm đó.

Ví dụ có căn cứ trong mã:

| Quan hệ | Lý do |
|---|---|
| Đặt lịch khám include Giữ chỗ khung giờ | Luồng tạo hold trước khi xác nhận lịch |
| Đặt lịch khám include Xác nhận lịch hẹn | Chỉ xác nhận hold thành công mới tạo lịch chính thức |
| Đổi lịch include Giữ chỗ khung giờ | Cần hold thay thế trước khi đổi lịch |
| Tiếp nhận có hẹn/đến trực tiếp include Tạo lượt khám và số thứ tự | Hai cách tiếp nhận đều tạo lượt khám/vé hàng đợi |
| Lập phiếu thu include Đối chiếu dịch vụ và giá đã chốt | Máy chủ lấy bằng chứng dịch vụ thực hiện và giá nguồn |
| Hoàn tất lượt khám include Kiểm tra hồ sơ đã xác nhận | Máy chủ cần bằng chứng VALIDATED phù hợp |
| Thanh toán online include Xác minh giao dịch với cổng | Kết quả tiền dựa trên máy chủ/cổng, không dựa vào URL trình duyệt |

Không nối “Hủy lịch” hoặc “Đổi lịch” bằng extend vào “Đặt lịch”: chúng tác động lên lịch đã tồn tại và là mục tiêu độc lập. Không nối “Lập phiếu” include “Hoàn tất khám”: hoàn tất khám là điều kiện đã xảy ra trước đó, không được thu ngân thực hiện lại khi lập phiếu.

## 6. Ba đặc tả mẫu

### UC05 — Đặt lịch khám

- Actor chính: Bệnh nhân.
- Tiền điều kiện: đã đăng nhập; hồ sơ bệnh nhân hợp lệ; phòng khám/chi nhánh/bác sĩ/dịch vụ đủ điều kiện đặt lịch.
- Luồng chính: chọn dịch vụ/bác sĩ/ngày → xem khung giờ và giá → chọn giờ → hệ thống giữ chỗ tạm thời → bệnh nhân xác nhận → hệ thống kiểm tra hold và tạo lịch → hiển thị mã lịch.
- Luồng thay thế: hết chỗ, hold hết hạn, lịch bác sĩ thay đổi hoặc dữ liệu không còn hợp lệ → thông báo và yêu cầu chọn lại.
- Hậu điều kiện: tạo một lịch xác nhận với giá đã chốt; không phát sinh thu cọc.

### UC17 — Tiếp nhận bệnh nhân có lịch hẹn

- Actor chính: Nhân viên STAFF.
- Tiền điều kiện: đăng nhập và có quyền tiếp nhận; lịch thuộc phòng khám/chi nhánh phù hợp, đủ điều kiện check-in.
- Luồng chính: tra cứu lịch → xác minh bệnh nhân → chọn điểm phục vụ → xác nhận tiếp nhận → hệ thống tạo lượt khám và vé hàng đợi → hiển thị số thứ tự.
- Luồng thay thế: sai bệnh nhân, lịch không đủ điều kiện, đã tiếp nhận, dữ liệu đổi hoặc chưa xác minh được trạng thái → tải lại/đối chiếu; lỗi phản hồi sau thao tác có thể cần đọc lại kết quả hoặc phục hồi tiếp nhận.
- Hậu điều kiện: lượt khám/vé đã được ghi nhận; gửi lại cùng lệnh không tạo thêm lượt.

### UC36 — Ghi nhận thu tiền tại quầy

- Actor chính: Nhân viên STAFF.
- Tiền điều kiện: có quyền BILLING; phiếu còn dư; ca của người thu đang OPEN; hóa đơn không bị giữ bởi giao dịch online đang hoạt động hoặc trạng thái cần đối chiếu.
- Luồng chính: chọn phiếu → nhập số tiền và phương thức → với chuyển khoản/POS nhập mã giao dịch đã xác minh → xác nhận → hệ thống cập nhật số đã thu/số còn lại, ghi sổ và tạo biên nhận → xem/in biên nhận.
- Luồng thay thế: vượt dư nợ, phiếu thay đổi, mã giao dịch đã ghi nhận hoặc ca không còn mở → từ chối và yêu cầu đối chiếu; khi đã nhận biên nhận nhưng tải lại thất bại, đọc lại kết quả.
- Hậu điều kiện: một khoản thu hợp lệ được ghi nhận; phiếu PAID hoặc PARTIALLY_PAID; biên nhận là nội bộ.

## 7. Giới hạn cần viết đúng

- Xét nghiệm thuộc DOCTOR ở mô hình hiện tại, với kiểm tra phân công và phạm vi riêng.
- Có đọc hồ sơ khám/kết quả cá nhân trong mã hiện tại. Điều kiện: hồ sơ đã VALIDATED, lượt khám CLINICALLY_COMPLETED/CLOSED, phiên bản phù hợp; chỉ hiển thị kết quả đã REVIEWED.
- VALIDATED không có nghĩa đã ký số. Không đưa ký số, phát hành tài liệu y tế có chữ ký hoặc mở lại hồ sơ đã xác nhận vào chức năng hiện có.
- Thanh toán online đã có phần mở rộng mới, nên tài liệu S3/S5 cũ nói “online disabled” không còn áp dụng đầy đủ. Chỉ áp dụng thanh toán cho hóa đơn sau khám; VNPAY hiện dùng sandbox.
- QR chuyển khoản thủ công không tự chứng minh đã nhận tiền.
- Không mô tả hoàn tiền tự động, quyết toán cổng thanh toán hay hóa đơn thuế như chức năng đã có.
- Không thêm quản lý kho thuốc, bán thuốc, bảo hiểm, điều dưỡng hoặc quyền người giám hộ khi chưa có căn cứ trong phạm vi đã đọc.
- Hoàn tất/đóng lượt khám độc lập với việc thu đủ tiền.
- Chức năng công khai phòng khám phụ thuộc cấu hình; có mã nguồn không có nghĩa đã kiểm thử tích hợp nhà cung cấp thành công.

## 8. Căn cứ trong dự án

Các liên kết dưới đây tính từ thư mục tài liệu này:

- [Vai trò giao diện](../../frontend/src/auth/access.ts).
- [Vai trò IAM hiện tại](../../backend/identity-service/modules/identity/src/main/java/com/clinic/iam/domain/MembershipRole.java).
- [Phân quyền theo capability](../../backend/identity-service/modules/identity/src/main/java/com/clinic/iam/service/MembershipService.java).
- [Migration gộp vai trò](../../backend/identity-service/modules/identity/src/main/resources/modules/identity/db/migration/V2__academic_roles.sql).
- [API đặt lịch/hồ sơ/thông báo](../../frontend/src/api/booking.ts).
- [API tiếp nhận/hàng đợi](../../frontend/src/api/reception.ts).
- [API khám](../../frontend/src/api/care.ts).
- [API xét nghiệm](../../backend/patient-service/modules/medical/src/main/java/com/clinic/medical/api/MedicalController.java).
- [Quyền xét nghiệm hiện tại](../../backend/patient-service/modules/medical/src/main/java/com/clinic/medical/service/MedicalService.java).
- [Hồ sơ y tế cá nhân](../../backend/patient-service/modules/medical/src/main/java/com/clinic/medical/service/PatientRecordService.java).
- [API thu phí](../../frontend/src/api/billing.ts) và [quyền thu/duyệt ca](../../backend/billing-service/modules/billing/src/main/java/com/clinic/billing/service/BillingService.java).
- [API quản trị](../../frontend/src/api/configuration.ts).
- [API kiểm duyệt](../../frontend/src/api/platform.ts).
- [Mở rộng thanh toán online](../contracts/invoice-online-payments.md).

## 9. Sử dụng các file

Hình SVG tổng quát là vector có thể đưa vào báo cáo hoặc mở trên trình duyệt. Các file .puml là nguồn PlantUML để tùy chỉnh và render lại bằng công cụ hỗ trợ PlantUML. Chưa render/kiểm tra cú pháp bằng PlantUML trong phiên này.

Nếu vẽ thủ công bằng draw.io/StarUML, dùng tên actor, use case và quan hệ trong các file làm nội dung. Đặt mã UC vào bảng đặc tả và giữ tên ngắn trong hình. Bản tổng quát bỏ phần đăng nhập chung để giảm đường nối.

