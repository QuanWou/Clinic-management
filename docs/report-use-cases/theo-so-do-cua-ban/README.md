# Use case chi tiết theo sơ đồ tổng quát của bạn

Bộ này bám theo tên nhóm chức năng và 4 tác nhân trong hình bạn gửi: Admin, Bác sĩ, Lễ tân / Thu ngân, Bệnh nhân. Có 17 sơ đồ nghiệp vụ và 1 sơ đồ Đăng nhập. Bố cục actor bên trái, chức năng chính ở giữa và chức năng chi tiết bên phải, tông vàng như ví dụ.

Ngày đối chiếu mã nguồn: 07/10/2026. Nội dung dựa trên mã nguồn hiện có, gồm thay đổi chưa commit. Đây là mô hình phân tích đề xuất cho báo cáo; không thay thế kết quả kiểm thử chức năng đang chạy.

## Các file chính

- **usecase-chi-tiet.drawio**: một file, 18 trang. Các actor, elip, đường nối và nhãn là thành phần có thể chỉnh sửa, không phải ảnh nền.
- **01…18 .png**: ảnh xuất ở kích thước gấp đôi bản vector để đưa vào Word.
- **01…18 .svg**: bản vector, giữ chất lượng khi phóng to.
- **00-tong-hop.png**: ảnh xem nhanh toàn bộ bộ sơ đồ.
- **diagrams.json**: danh mục chức năng và quan hệ để tái tạo.
- **generate.mjs**: script đã dùng để xuất các ảnh và file draw.io.

Mở file .drawio trong draw.io và chọn các trang ở thanh bên dưới. Trong báo cáo, ưu tiên ảnh PNG riêng của từng hình để chữ dễ đọc; ảnh tổng hợp chỉ dùng xem nhanh.

## Danh sách 18 sơ đồ

| Hình | Chức năng từ sơ đồ tổng quát | Tác nhân | PNG | SVG |
|---|---|---|---|---|
| 01 | Quản lý phòng khám | Admin | [Ảnh](01-quan-ly-phong-kham.png) | [Vector](01-quan-ly-phong-kham.svg) |
| 02 | Quản lý nhân sự | Admin | [Ảnh](02-quan-ly-nhan-su.png) | [Vector](02-quan-ly-nhan-su.svg) |
| 03 | Quản lý bác sĩ | Admin | [Ảnh](03-quan-ly-bac-si.png) | [Vector](03-quan-ly-bac-si.svg) |
| 04 | Quản lý dịch vụ, bảng giá | Admin | [Ảnh](04-dich-vu-bang-gia.png) | [Vector](04-dich-vu-bang-gia.svg) |
| 05 | Giám sát vận hành | Admin | [Ảnh](05-giam-sat-van-hanh.png) | [Vector](05-giam-sat-van-hanh.svg) |
| 06 | Tài chính và nhật ký | Admin | [Ảnh](06-tai-chinh-nhat-ky.png) | [Vector](06-tai-chinh-nhat-ky.svg) |
| 07 | Tiếp nhận bệnh nhân | Lễ tân / Thu ngân | [Ảnh](07-tiep-nhan-benh-nhan.png) | [Vector](07-tiep-nhan-benh-nhan.svg) |
| 08 | Quản lý hàng đợi | Lễ tân / Thu ngân | [Ảnh](08-quan-ly-hang-doi.png) | [Vector](08-quan-ly-hang-doi.svg) |
| 09 | Quản lý ca thu | Lễ tân / Thu ngân | [Ảnh](09-quan-ly-ca-thu.png) | [Vector](09-quan-ly-ca-thu.svg) |
| 10 | Khám và ghi hồ sơ | Bác sĩ | [Ảnh](10-kham-ghi-ho-so.png) | [Vector](10-kham-ghi-ho-so.svg) |
| 11 | Quản lý chỉ định, kết quả xét nghiệm | Bác sĩ | [Ảnh](11-chi-dinh-ket-qua.png) | [Vector](11-chi-dinh-ket-qua.svg) |
| 12 | Xác nhận hồ sơ, hoàn tất lượt khám | Bác sĩ | [Ảnh](12-xac-nhan-hoan-tat.png) | [Vector](12-xac-nhan-hoan-tat.svg) |
| 13 | Đăng ký tài khoản | Bệnh nhân | [Ảnh](13-dang-ky-tai-khoan.png) | [Vector](13-dang-ky-tai-khoan.svg) |
| 14 | Tra cứu phòng khám, bác sĩ… | Bệnh nhân | [Ảnh](14-tra-cuu-cong-khai.png) | [Vector](14-tra-cuu-cong-khai.svg) |
| 15 | Quản lý lịch hẹn | Bệnh nhân | [Ảnh](15-quan-ly-lich-hen.png) | [Vector](15-quan-ly-lich-hen.svg) |
| 16 | Xem lịch sử khám | Bệnh nhân | [Ảnh](16-xem-lich-su-kham.png) | [Vector](16-xem-lich-su-kham.svg) |
| 17 | Thanh toán hóa đơn online | Bệnh nhân | [Ảnh](17-thanh-toan-online.png) | [Vector](17-thanh-toan-online.svg) |
| 18 | Đăng nhập | Admin / Bác sĩ / Lễ tân / Bệnh nhân | [Ảnh](18-dang-nhap.png) | [Vector](18-dang-nhap.svg) |

## Cách đọc quan hệ

- **Đường liền không mũi tên giữa actor và elip**: actor tham gia chức năng.
- **Nét đứt, mũi tên mở, «include»**: chức năng gốc sử dụng một chức năng bắt buộc. Hướng mũi tên từ gốc sang chức năng được sử dụng.
- **Nét đứt, mũi tên mở, «extend»**: thao tác bổ sung vào luồng cơ sở ở điều kiện ghi trong ngoặc vuông. Hướng mũi tên từ chức năng mở rộng về chức năng cơ sở.
- **Đường liền, tam giác rỗng hướng về elip «abstract»**: các mục tiêu cụ thể chuyên biệt hóa nhóm chức năng tổng quát. Nhóm abstract không được hiểu là một thao tác luôn thực hiện tất cả chức năng con.
- Không dùng các đường nối để biểu diễn thứ tự thời gian. Luồng bước 1, bước 2… nên nằm trong đặc tả hoặc activity diagram.

### Vì sao không dùng extend cho tất cả chức năng con?

Ví dụ bạn gửi có cùng bố cục, nhưng nhãn extend không tự có nghĩa là “chia một chức năng thành các chức năng nhỏ”. Bộ này chọn quan hệ theo ý nghĩa:

- Quản lý nhân sự có luồng cơ sở xem danh sách. Thêm / sửa / phân quyền / khóa / đặt lại mật khẩu là các thao tác lựa chọn, được mô hình hóa bằng extend với điều kiện và điểm mở rộng rõ.
- Đặt / đổi / hủy / xem / tái khám là những mục tiêu riêng của nhóm Quản lý lịch hẹn, nên được mô hình hóa bằng chuyên biệt hóa. Không mô tả Hủy lịch là phần mở rộng của Đặt lịch.
- Các bước giữ chỗ và xác nhận lịch là phần được dùng trong Đặt lịch, nên dùng include.
- Việc Hoàn tất lượt khám kiểm tra bằng chứng hồ sơ đã xác nhận, chứ không xác nhận lại hồ sơ mỗi lần hoàn tất.

Trong các sơ đồ quản lý dùng extend, điểm mở rộng là **chọn thao tác quản lý sau khi hiển thị thông tin/danh sách**. Nếu bạn chọn mô hình mỗi thao tác là một use case hoàn toàn độc lập, có thể thay các quan hệ extend bằng kết nối trực tiếp actor đến các thao tác; cần giữ cách diễn giải nhất quán trong phần đặc tả.

### Đăng nhập

Hình 18 trình bày riêng Đăng nhập. Các hình nghiệp vụ chỉ ghi đăng nhập là **tiền điều kiện**: một phiên đã đăng nhập có thể thực hiện nhiều thao tác mà không đăng nhập lại.

Đăng ký và tra cứu công khai không yêu cầu đăng nhập. Vì vậy nên sửa các đường include Đăng nhập từ những chức năng công khai trong sơ đồ tổng quát của bạn. Không thêm chức năng quên mật khẩu / OTP vì phần đã đọc chưa có luồng đó.

## Gợi ý bố trí trong báo cáo

1. Đặt sơ đồ tổng quát của bạn ở phần giới thiệu chức năng.
2. Đưa Hình 01–06 vào mục phân tích chức năng Admin.
3. Đưa Hình 07–09 vào mục Lễ tân / Thu ngân.
4. Đưa Hình 10–12 vào mục Bác sĩ.
5. Đưa Hình 13–17 vào mục Bệnh nhân.
6. Đưa Hình 18 vào mục Xác thực dùng chung.
7. Sau mỗi hình, mô tả ngắn actor, tiền điều kiện, mục tiêu và các điều kiện mở rộng. Viết đặc tả đầy đủ cho các chức năng trọng tâm.

Số **Hình 01…18** là số sơ đồ trong bộ này, không thay đổi mã UC01…UC54 đã đề xuất trong tài liệu cũ.

## Nội dung chi tiết từng hình

### Hình 01 — Quản lý phòng khám

**Tác nhân:** Admin.

**Tiền điều kiện:** Đã đăng nhập; có quyền cấu hình phòng khám.

| Chức năng chi tiết | Quan hệ với nhóm/chức năng chính | Điều kiện |
|---|---|---|
| Xem hồ sơ phòng khám | include | — |
| Cập nhật thông tin phòng khám | extend | Chọn cập nhật hồ sơ |
| Thêm / sửa chi nhánh | extend | Chọn quản lý chi nhánh |
| Cập nhật thông tin giấy phép | extend | Chọn sửa giấy phép |
| Gửi hồ sơ kiểm duyệt | extend | Hồ sơ đủ điều kiện gửi |

Luồng cơ sở: xem hồ sơ; điểm mở rộng: chọn thao tác quản lý. Phạm vi phòng khám / chi nhánh được kiểm tra trên máy chủ.

### Hình 02 — Quản lý nhân sự

**Tác nhân:** Admin.

**Tiền điều kiện:** Đã đăng nhập; có quyền quản lý nhân sự tại phòng khám.

| Chức năng chi tiết | Quan hệ với nhóm/chức năng chính | Điều kiện |
|---|---|---|
| Xem danh sách nhân sự | include | — |
| Thêm / liên kết tài khoản nhân viên | extend | Chọn thêm nhân viên |
| Sửa thông tin nhân viên | extend | Chọn sửa thông tin |
| Gán vai trò và phạm vi chi nhánh | extend | Chọn phân quyền |
| Khóa / vô hiệu hóa tài khoản nhân viên | extend | Chọn đổi trạng thái |
| Đặt lại mật khẩu nhân viên | extend | Chọn đặt lại mật khẩu |

Luồng cơ sở: xem danh sách; điểm mở rộng: chọn thao tác nhân sự. Vai trò nhân sự hiện tại: ADMIN, STAFF, DOCTOR.

### Hình 03 — Quản lý bác sĩ

**Tác nhân:** Admin.

**Tiền điều kiện:** Đã đăng nhập; có quyền quản lý bác sĩ và lịch làm việc.

| Chức năng chi tiết | Quan hệ với nhóm/chức năng chính | Điều kiện |
|---|---|---|
| Xem danh sách bác sĩ | include | — |
| Thêm / cập nhật liên kết bác sĩ | extend | Chọn quản lý bác sĩ |
| Cập nhật chuyên khoa và thông tin công khai | extend | Chọn sửa thông tin |
| Thêm / sửa lịch làm việc | extend | Chọn quản lý lịch |
| Ghi nhận khoảng vắng của bác sĩ | extend | Bác sĩ có lịch vắng |
| Sửa / hủy khoảng vắng | extend | Khoảng vắng được chọn |

Luồng cơ sở: xem danh sách; điểm mở rộng: chọn thao tác bác sĩ. Khoảng vắng và lịch làm việc ảnh hưởng khả năng đặt lịch.

### Hình 04 — Quản lý dịch vụ, bảng giá

**Tác nhân:** Admin.

**Tiền điều kiện:** Đã đăng nhập; có quyền quản lý danh mục và bảng giá.

| Chức năng chi tiết | Quan hệ với nhóm/chức năng chính | Điều kiện |
|---|---|---|
| Xem danh mục dịch vụ | include | — |
| Thêm / sửa dịch vụ và chuyên khoa | extend | Chọn quản lý dịch vụ |
| Gán dịch vụ cho chi nhánh | extend | Chọn phạm vi cung cấp |
| Cấu hình thời lượng và trạng thái dịch vụ | extend | Chọn sửa cấu hình |
| Xem các phiên bản giá | extend | Chọn xem bảng giá |
| Thêm giá và ngày bắt đầu áp dụng | extend | Chọn tạo giá mới |

Luồng cơ sở: xem danh mục; điểm mở rộng: chọn thao tác dịch vụ / giá. Giá mới không sửa lại giá đã chốt của dịch vụ đã thực hiện.

### Hình 05 — Giám sát vận hành

**Tác nhân:** Admin.

**Tiền điều kiện:** Đã đăng nhập; có quyền xem / quản lý vận hành.

| Chức năng chi tiết | Quan hệ với nhóm/chức năng chính | Điều kiện |
|---|---|---|
| Xem tổng quan lượt khám trong ngày | Chuyên biệt hóa | — |
| Xem trạng thái hàng đợi và lượt chờ kết quả | Chuyên biệt hóa | — |
| Xem xu hướng lượt khám 7 ngày | Chuyên biệt hóa | — |
| Xem ngoại lệ lịch hẹn và yêu cầu tiếp nhận | Chuyên biệt hóa | — |
| Xử lý yêu cầu cần quản trị | Chuyên biệt hóa | — |
| Phục hồi tiếp nhận / đồng bộ lỗi đủ điều kiện | Chuyên biệt hóa | — |

Các hình bên phải là mục tiêu chuyên biệt của nhóm giám sát. Quyền xem và quyền phục hồi dữ liệu được kiểm tra riêng.

### Hình 06 — Tài chính và nhật ký

**Tác nhân:** Admin.

**Tiền điều kiện:** Đã đăng nhập; có quyền tài chính / nhật ký tương ứng.

| Chức năng chi tiết | Quan hệ với nhóm/chức năng chính | Điều kiện |
|---|---|---|
| Xem phát sinh, đã thu và số còn phải thu | Chuyên biệt hóa | — |
| Xem cơ cấu phương thức và xu hướng tài chính | Chuyên biệt hóa | — |
| Đối soát và duyệt ca thu đã chốt | Chuyên biệt hóa | — |
| Phê duyệt giảm trừ hóa đơn | Chuyên biệt hóa | — |
| Xem giao dịch cần đối chiếu / đồng bộ phí | Chuyên biệt hóa | — |
| Xem nhật ký hoạt động và thay đổi phân quyền | Chuyên biệt hóa | — |

ADMIN quản trị tài chính; không mặc nhiên được thu tiền tại quầy. Người duyệt ca phải khác người thu. Biên nhận nội bộ không phải hóa đơn thuế.

### Hình 07 — Tiếp nhận bệnh nhân

**Tác nhân:** Lễ tân / Thu ngân.

**Tiền điều kiện:** Đã đăng nhập; STAFF có quyền tiếp nhận tại phòng khám.

| Chức năng chi tiết | Quan hệ với nhóm/chức năng chính | Điều kiện |
|---|---|---|
| Tra cứu và xác minh hồ sơ bệnh nhân | Chuyên biệt hóa | — |
| Tạo hồ sơ bệnh nhân đến trực tiếp | Chuyên biệt hóa | — |
| Xem lịch hẹn trong ngày | Chuyên biệt hóa | — |
| Tiếp nhận bệnh nhân có lịch hẹn | Chuyên biệt hóa | — |
| Tiếp nhận bệnh nhân đến trực tiếp | Chuyên biệt hóa | — |
| Đổi lịch tại quầy / ghi nhận yêu cầu tiếp nhận | Chuyên biệt hóa | — |

**Quan hệ bổ sung:** Tiếp nhận bệnh nhân có lịch hẹn include Tạo lượt khám và số thứ tự; Tiếp nhận bệnh nhân đến trực tiếp include Tạo lượt khám và số thứ tự.

Tạo hồ sơ mới chỉ cần khi chưa có hồ sơ bệnh nhân phù hợp. Hai hình thức tiếp nhận tạo lượt khám và vé hàng đợi; không thu cọc.

### Hình 08 — Quản lý hàng đợi

**Tác nhân:** Lễ tân / Thu ngân.

**Tiền điều kiện:** Đã đăng nhập; có quyền tiếp nhận; chọn chi nhánh / điểm phục vụ.

| Chức năng chi tiết | Quan hệ với nhóm/chức năng chính | Điều kiện |
|---|---|---|
| Xem hàng đợi theo điểm phục vụ / ngày | include | — |
| Gọi / gọi lại bệnh nhân | extend | Chọn gọi vé đủ điều kiện |
| Bỏ qua / ghi vắng bệnh nhân | extend | Vé có thể bỏ qua / ghi vắng |
| Xếp lại bệnh nhân vào hàng đợi | extend | Vé đủ điều kiện xếp lại |
| Chuyển điểm phục vụ | extend | Chọn điểm đích hợp lệ |
| Chuyển tiếp vé sang ngày mới | extend | Vé đủ điều kiện chuyển tiếp |

Luồng cơ sở: xem hàng đợi; điểm mở rộng: chọn thao tác trên vé. Mỗi thao tác chỉ được thực hiện ở trạng thái vé và phạm vi được phép.

### Hình 09 — Quản lý ca thu

**Tác nhân:** Lễ tân / Thu ngân.

**Tiền điều kiện:** Đã đăng nhập; STAFF có quyền BILLING tại chi nhánh.

| Chức năng chi tiết | Quan hệ với nhóm/chức năng chính | Điều kiện |
|---|---|---|
| Mở ca thu | Chuyên biệt hóa | — |
| Xem ca thu và các phiếu / khoản thu | Chuyên biệt hóa | — |
| Lập phiếu thu cho lượt khám hoàn tất | Chuyên biệt hóa | — |
| Ghi nhận thu tiền mặt / chuyển khoản / POS | Chuyên biệt hóa | — |
| Xem / in biên nhận nội bộ | Chuyên biệt hóa | — |
| Kiểm đếm, chốt và gửi ca thu | Chuyên biệt hóa | — |

**Quan hệ bổ sung:** Lập phiếu thu cho lượt khám hoàn tất include Đối chiếu dịch vụ và giá đã chốt.

Nghiệp vụ thu phí được đặt cùng ca thu theo nhóm chức năng trong hình tổng quát. Thu tiền cần ca OPEN của người thu; ca đã chốt chờ Admin duyệt; không tự duyệt.

### Hình 10 — Khám và ghi hồ sơ

**Tác nhân:** Bác sĩ.

**Tiền điều kiện:** Đã đăng nhập; DOCTOR được phân công lượt khám.

| Chức năng chi tiết | Quan hệ với nhóm/chức năng chính | Điều kiện |
|---|---|---|
| Xem danh sách khám được phân công | Chuyên biệt hóa | — |
| Gọi và bắt đầu khám | Chuyên biệt hóa | — |
| Xem / ghi / cập nhật hồ sơ khám | Chuyên biệt hóa | — |
| Ghi chẩn đoán, kết luận và hướng dẫn | Chuyên biệt hóa | — |
| Ghi đề xuất ngày tái khám | Chuyên biệt hóa | — |
| Chuyển chờ kết quả / đưa lại vào hàng đợi | Chuyên biệt hóa | — |

Nội dung hồ sơ gồm lý do khám, tiền sử, dị ứng, sinh hiệu, khám và kết luận. Ghi ngày tái khám mới tạo đề xuất; bệnh nhân cần đặt lịch tái khám riêng.

### Hình 11 — Quản lý chỉ định, kết quả xét nghiệm

**Tác nhân:** Bác sĩ.

**Tiền điều kiện:** Đã đăng nhập; có quyền DOCTOR_WORK / LAB_WORK và đúng phạm vi.

| Chức năng chi tiết | Quan hệ với nhóm/chức năng chính | Điều kiện |
|---|---|---|
| Tạo chỉ định xét nghiệm | Chuyên biệt hóa | — |
| Xem chỉ định và lịch sử kết quả | Chuyên biệt hóa | — |
| Tiếp nhận / xử lý chỉ định | Chuyên biệt hóa | — |
| Từ chối / hủy chỉ định đủ điều kiện | Chuyên biệt hóa | — |
| Ghi / cập nhật kết quả xét nghiệm | Chuyên biệt hóa | — |
| Duyệt kết quả xét nghiệm | Chuyên biệt hóa | — |

Mã nguồn hiện dùng vai trò DOCTOR cho chức năng xét nghiệm. Các thao tác kiểm tra phân công lượt khám, người xử lý và trạng thái chỉ định.

### Hình 12 — Xác nhận hồ sơ, hoàn tất lượt khám

**Tác nhân:** Bác sĩ.

**Tiền điều kiện:** Đã đăng nhập; bác sĩ được phân công; lượt khám đúng trạng thái.

| Chức năng chi tiết | Quan hệ với nhóm/chức năng chính | Điều kiện |
|---|---|---|
| Kiểm tra hồ sơ và trạng thái chỉ định | Chuyên biệt hóa | — |
| Xác nhận hồ sơ khám (VALIDATED) | Chuyên biệt hóa | — |
| Xác nhận dịch vụ khám đã thực hiện | Chuyên biệt hóa | — |
| Hoàn tất lượt khám | Chuyên biệt hóa | — |
| Đóng lượt khám đã hoàn tất | Chuyên biệt hóa | — |

**Quan hệ bổ sung:** Hoàn tất lượt khám include Kiểm tra bằng chứng hồ sơ đã xác nhận.

VALIDATED yêu cầu đủ trường hồ sơ và các chỉ định đã xử lý đúng điều kiện. Xác nhận không phải ký số; hoàn tất / đóng lượt khám độc lập với thanh toán.

### Hình 13 — Đăng ký tài khoản

**Tác nhân:** Bệnh nhân.

**Tiền điều kiện:** Chưa cần đăng nhập; đăng ký tài khoản bệnh nhân.

| Chức năng chi tiết | Quan hệ với nhóm/chức năng chính | Điều kiện |
|---|---|---|
| Kiểm tra thông tin đăng ký hợp lệ | include | — |
| Kiểm tra email chưa được sử dụng | include | — |
| Tạo tài khoản bệnh nhân | include | — |

Dữ liệu đăng ký: họ tên, email, mật khẩu; mật khẩu từ 8 đến 100 ký tự. Hệ thống lưu mật khẩu dạng băm. Không có căn cứ cho OTP / xác thực email trong luồng này.

### Hình 14 — Tra cứu phòng khám, bác sĩ…

**Tác nhân:** Bệnh nhân.

**Tiền điều kiện:** Không bắt buộc đăng nhập; thông tin phải đủ điều kiện công khai.

| Chức năng chi tiết | Quan hệ với nhóm/chức năng chính | Điều kiện |
|---|---|---|
| Xem thông tin phòng khám / chi nhánh | Chuyên biệt hóa | — |
| Tra cứu bác sĩ và chuyên khoa | Chuyên biệt hóa | — |
| Xem dịch vụ và bảng giá | Chuyên biệt hóa | — |
| Xem lịch làm việc và khung giờ còn chỗ | Chuyên biệt hóa | — |
| Xem thông tin địa chỉ / liên hệ | Chuyên biệt hóa | — |

Giữ actor Bệnh nhân như hình tổng quát; khách chưa có tài khoản cũng có thể tra cứu. Tra cứu lịch trống không đồng nghĩa đã giữ chỗ hay tạo lịch hẹn.

### Hình 15 — Quản lý lịch hẹn

**Tác nhân:** Bệnh nhân.

**Tiền điều kiện:** Đã đăng nhập; hồ sơ hợp lệ; chỉ thao tác lịch thuộc tài khoản.

| Chức năng chi tiết | Quan hệ với nhóm/chức năng chính | Điều kiện |
|---|---|---|
| Đặt lịch khám | Chuyên biệt hóa | — |
| Xem lịch hẹn của tôi | Chuyên biệt hóa | — |
| Đổi lịch hẹn | Chuyên biệt hóa | — |
| Hủy lịch hẹn | Chuyên biệt hóa | — |
| Đặt lịch tái khám | Chuyên biệt hóa | — |

**Quan hệ bổ sung:** Đặt lịch khám include Giữ chỗ khung giờ; Đặt lịch khám include Xác nhận lịch hẹn; Đổi lịch hẹn include Giữ chỗ khung giờ mới; Đặt lịch tái khám include Giữ chỗ và xác nhận lịch tái khám.

Đặt / đổi / hủy là các mục tiêu chuyên biệt của quản lý lịch; không mở rộng lẫn nhau. Khung giờ và lịch hẹn phải đủ điều kiện; đặt lịch không thu cọc.

### Hình 16 — Xem lịch sử khám

**Tác nhân:** Bệnh nhân.

**Tiền điều kiện:** Đã đăng nhập; xác minh quyền sở hữu hồ sơ của chính tài khoản.

| Chức năng chi tiết | Quan hệ với nhóm/chức năng chính | Điều kiện |
|---|---|---|
| Xem hồ sơ khám đã hoàn tất | Chuyên biệt hóa | — |
| Xem kết quả xét nghiệm đã được duyệt | Chuyên biệt hóa | — |
| Xem hướng dẫn và đề xuất tái khám | Chuyên biệt hóa | — |
| Xem hóa đơn, số đã trả / còn lại | Chuyên biệt hóa | — |
| Xem biên nhận thanh toán | Chuyên biệt hóa | — |
| Xem hướng dẫn QR chuyển khoản | Chuyên biệt hóa | — |

Hồ sơ VALIDATED và lượt CLINICALLY_COMPLETED / CLOSED, phiên bản phù hợp. Không đọc hồ sơ người khác; chưa có quyền người giám hộ / đại diện trong phạm vi này.

### Hình 17 — Thanh toán hóa đơn online

**Tác nhân:** Bệnh nhân.

**Tiền điều kiện:** Đã đăng nhập; hóa đơn thuộc bệnh nhân, còn dư và được phép thanh toán.

| Chức năng chi tiết | Quan hệ với nhóm/chức năng chính | Điều kiện |
|---|---|---|
| Chọn phương thức đang khả dụng | include | — |
| Tạo yêu cầu thanh toán online | include | — |
| Xác minh kết quả với cổng thanh toán | include | — |
| Hủy liên kết payOS chưa thanh toán | extend | Chọn hủy; cổng cho phép |

**Tác nhân hỗ trợ:** Cổng thanh toán (payOS / VNPAY) tham gia Xác minh kết quả với cổng thanh toán.

payOS / VNPAY xác nhận qua máy chủ; VNPAY hiện dùng sandbox. Chỉ thanh toán hóa đơn sau khám; không thu cọc. QR thủ công được tách ở phần xem lịch sử / chi phí.

### Hình 18 — Đăng nhập

**Tác nhân:** Admin / Bác sĩ / Lễ tân / Bệnh nhân.

**Tiền điều kiện:** Người dùng có tài khoản; truy cập đúng cổng bệnh nhân hoặc workspace.

| Chức năng chi tiết | Quan hệ với nhóm/chức năng chính | Điều kiện |
|---|---|---|
| Kiểm tra thông tin đăng nhập | include | — |
| Kiểm tra trạng thái tài khoản | include | — |
| Xác định quyền và phạm vi truy cập | include | — |
| Thiết lập phiên đăng nhập | include | — |

Tài khoản phải ACTIVE; cổng workspace kiểm tra quyền nhân sự / nền tảng. Đăng nhập được mô tả riêng; trong sơ đồ nghiệp vụ, ghi là tiền điều kiện.

## Các điểm cần giữ đúng với dự án

- STAFF triển khai cả lễ tân và thu ngân; DOCTOR triển khai cả khám và phần xét nghiệm. Không có actor kỹ thuật viên độc lập trong mô hình hiện tại.
- ADMIN không mặc nhiên có quyền tiếp nhận, thu tiền hoặc khám.
- Quản lý ca thu được mở rộng chi tiết đến lập phiếu và ghi nhận tiền để bao quát công việc thu ngân trong nhóm của sơ đồ tổng quát. Lượt khám phải đủ điều kiện lập phiếu; thu tiền tại quầy cần ca OPEN.
- Thanh toán online cho hóa đơn sau khám, không thu cọc lịch hẹn.
- VNPAY hiện dùng sandbox. Xem hướng dẫn QR thủ công được đặt trong nhóm xem lịch sử / chi phí, không buộc nhánh QR phải nhận xác nhận tự động từ cổng thanh toán.
- Xác nhận hồ sơ không phải ký số; hoàn tất / đóng lượt khám độc lập với thu tiền.
- Không thêm quản lý thuốc, kho, bảo hiểm, hoàn tiền tự động hay hóa đơn thuế vào bộ này.
- Giữ actor Bệnh nhân ở hình tra cứu / đăng ký như hình tổng quát. Trong đặc tả ghi rõ người chưa đăng nhập cũng có thể dùng hai nhóm chức năng này.

## Căn cứ mã nguồn

Các liên kết sau tương đối với thư mục bộ sơ đồ:

- [Quyền giao diện](../../../frontend/src/auth/access.ts).
- [Quyền theo vai trò](../../../backend/identity-service/modules/identity/src/main/java/com/clinic/iam/service/MembershipService.java).
- [Quản trị và cấu hình](../../../frontend/src/api/configuration.ts).
- [Tiếp nhận / hàng đợi](../../../frontend/src/api/reception.ts).
- [Khám](../../../frontend/src/api/care.ts).
- [Chỉ định / kết quả](../../../frontend/src/api/medical.ts).
- [Lịch hẹn / đăng ký](../../../frontend/src/api/booking.ts).
- [Thu phí / ca thu](../../../frontend/src/api/billing.ts).
- [Thanh toán online](../../../frontend/src/api/payments.ts).
- [Vận hành](../../../frontend/src/api/operations.ts).
- [Nhật ký](../../../frontend/src/api/audit.ts).

Ảnh đã được render và kiểm tra bố cục; file draw.io được kiểm tra cấu trúc XML, số trang và tham chiếu đường nối. Chưa mở để kiểm tra thao tác chỉnh sửa trực tiếp trong draw.io.

