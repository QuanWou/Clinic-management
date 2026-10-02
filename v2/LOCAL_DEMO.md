# Chạy Clinic V2 local

Chạy bằng PowerShell 7 trong worktree chứa thư mục `v2`:

```powershell
& ./v2/scripts/start-local-demo.ps1
```

Lệnh khởi chạy 12 dịch vụ V2, Identity đăng ký/đăng nhập hiện có, PostgreSQL 17 và React/Vite. Web có ba khu vực riêng: `/public` (giới thiệu phòng khám), `/public/booking` (đặt lịch), `/public/account` (bệnh nhân), `/workspace` (phòng khám) và `/platform` (nền tảng), dùng chung trang đăng nhập tại `/login?area=public|workspace|platform`. Base URL: `http://127.0.0.1:4176`; PostgreSQL: `127.0.0.1:54320`. Mỗi dịch vụ dùng database riêng và tài khoản runtime không có superuser/BYPASSRLS. Chỉ PostgreSQL sandbox này được dùng để chạy migration; dữ liệu V1 không được đọc hoặc thay đổi.

Nếu các dịch vụ đã chạy, lệnh kiểm tra health rồi giữ nguyên phiên chạy. Nếu một lần khởi động chỉ thành công một phần, chạy lệnh dừng bên dưới trước khi khởi động lại. Không tự tắt tiến trình chiếm cổng thuộc ứng dụng khác. Sau khi sửa Java, cần build/verify package tương ứng trước khi khởi động lại; launcher từ chối JAR cũ hơn source.

Lần chạy đầu tạo tám tài khoản mật khẩu thật: `owner`, `manager`, `reception`, `doctor`, `lab`, `cashier`, `patient`, `platform` tại domain `clinic.local`. Mật khẩu được sinh riêng cho môi trường này và lưu trong `v2/.sandbox/local-demo/config.json`, thư mục đã bị Git ignore. Đây là thông tin đăng nhập mẫu local; không dùng để triển khai public.

Phòng khám An Nhiên, một địa điểm, bác sĩ có lịch 08:00–20:00 cả tuần, dịch vụ khám mẫu 120.000 VND, xét nghiệm nội bộ mẫu 80.000 VND, phòng khám và profile bệnh nhân mẫu được tạo. Membership/branch grants được bootstrap vào IAM của demo; các cấu hình nguồn còn lại được tạo qua API thật. Platform và Owner là hai tài khoản khác nhau. Kiểm duyệt/công bố dùng minh chứng ghi rõ `DEMO ONLY`, chỉ để Public/Search/booking có dữ liệu local; không chứng minh giấy phép hoặc phê duyệt production. Ký/phát hành hồ sơ và thanh toán online vẫn chưa bật.

| Tài khoản | Trang bắt đầu |
|---|---|
| `patient@clinic.local` | `/public/account` |
| `owner@clinic.local`, `manager@clinic.local` | `/workspace?view=overview` |
| `reception@clinic.local` | `/workspace?view=reception` |
| `doctor@clinic.local` | `/workspace?view=doctor` |
| `lab@clinic.local` | `/workspace?view=lab` |
| `cashier@clinic.local` | `/workspace?view=billing` |
| `platform@clinic.local` | `/platform` |

Nhân sự mở `/workspace` và đăng nhập ở trang chung: Owner/Manager vào Tổng quan, lễ tân vào Tiếp nhận, bác sĩ vào Danh sách khám, lab vào Chỉ định/kết quả và thu ngân vào Thu phí. Điều hướng chỉ hiện công việc đã được cấp quyền. Phiên được giữ khi chuyển màn hoặc đi giữa ba khu vực bằng liên kết trong ứng dụng; không cần nhập mật khẩu lại từng màn. Phiên hiện nằm trong bộ nhớ: tải lại trang hoặc mở tab mới cần đăng nhập lại, JWT/mật khẩu không được lưu vào localStorage/sessionStorage. Địa điểm duy nhất được cấp quyền “Cơ sở Demo” được chọn tự động; quyền nguồn vẫn được xác minh lại khi mở màn. Public là website giới thiệu một phòng khám: dịch vụ/giá, bác sĩ, hướng dẫn và địa chỉ/giờ hoạt động. Không có tìm kiếm/chọn cơ sở. Launcher truyền `VITE_PUBLIC_CLINIC_ID`; chỉ phòng khám này được dùng để đặt lịch. Dữ liệu công khai lấy từ Clinic/Search; một địa điểm được chọn sẵn, `branch_id` vẫn gửi đến backend. Nếu chưa cấu hình ID, web chỉ chấp nhận nguồn có đúng một phòng khám công bố; không tự chọn phần tử đầu khi có nhiều phòng khám. Trang chủ không hiển thị form hồ sơ hoặc lịch sử riêng tư. Bệnh nhân có thể đặt lịch không cọc; lễ tân tiếp nhận hoặc tạo walk-in, bác sĩ khám/lập chỉ định, lab xử lý, bác sĩ hoàn tất nội bộ và thu ngân lập phiếu/thu tại chỗ. Không cần dùng tài khoản Platform để khám hoặc thu tiền.

Để dừng:

```powershell
& ./v2/scripts/stop-local-demo.ps1
```

Lệnh chỉ dừng PID/executable/thời điểm khởi tạo đúng bản ghi của launcher và PostgreSQL có đúng data directory/cổng. Không xóa database hoặc tài khoản. Khởi chạy lại giữ nguyên dữ liệu người dùng đã thao tác; không seed lại khi demo đã hoàn tất khởi tạo.

Kiểm tra phiên đang chạy, không tắt dịch vụ sau kiểm tra:

```powershell
node ./v2/scripts/verify-local-demo.mjs
```

Kiểm tra health 13 backend, password login và IAM scope của 8 tài khoản, website Public đơn phòng khám tại 1366/1024/375 px, chọn sẵn dịch vụ/bác sĩ từ thẻ giới thiệu, availability, rồi đăng nhập thật 8 vai trò bằng trình duyệt Edge headless ở 1366×768. Kiểm tra màn bắt đầu theo vai trò, menu, địa điểm tự chọn, chuyển sang Cài đặt và browser Back với đúng một password login. Không tạo appointment, thu tiền hoặc revoke tài khoản. Kết quả không chứa mật khẩu ở `v2/.sandbox/local-demo/verification.json`; screenshot tương ứng ở cùng thư mục.

Log và PID ở `v2/.sandbox/local-demo/`; mật khẩu database/peer/JWT không được ghi vào tài liệu hoặc evidence công khai. Server chỉ nghe trên loopback. Các cổng backend: Auth 8083; Clinic 8092; IAM 8093; Doctor 8094; Catalog 8095; Audit 8096; Search 8097; Patient 8098; Appointment 8099; Notification 8100; Encounter 8101; Medical 8102; Billing 8103.
