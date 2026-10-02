# CMV2 — UX Strategy & Sitemap (Phase 04)

**Status:** Product Owner đã chốt hướng Public/Workspace ngày 2026-10-02; các chính sách tiền và biểu mẫu chuyên môn vẫn chưa được duyệt. **Baseline hiện tại:** một phòng khám · Public giới thiệu + booking không cọc · Workspace và Platform riêng. **No V1 changes.**

## Quyết định thay thế baseline marketplace

Product Owner yêu cầu “không cần tìm cơ sở vì phòng khám chỉ có 1 thôi” và “Tại public tôi cần 1 web giới thiệu phòng khám”. Product Owner cho phép tự đặt tên; tên dùng cho bản local là **Phòng khám An Nhiên**. Public không còn tìm kiếm/chọn cơ sở. Homepage giới thiệu, booking và tài khoản bệnh nhân là ba đường dẫn riêng; không đưa biểu mẫu đăng nhập/hồ sơ lên homepage. Workspace chỉ quản lý một clinic theo A0; branch là phạm vi vận hành trong từng workflow.

Luồng đã chọn: không cọc, thanh toán tại quầy và biên nhận nội bộ. Ký/phát hành tài liệu chuyên môn, thanh toán online, người thân và chính sách hoàn tiền nâng cao chưa được bật hoặc chấp nhận. Quyết định về cấu trúc web không đồng nghĩa A1–A6 hay production đã được chấp nhận.

## Information architecture principles

1. Public giới thiệu một phòng khám: thông tin, dịch vụ/giá, bác sĩ và hướng dẫn đến khám trước khi yêu cầu đăng nhập để xác nhận booking.
2. Patient identity tách khỏi clinical encounter. Tài khoản chỉ đọc lịch sử vận hành/biên nhận được cấp quyền; tài liệu chuyên môn chưa phát hành không hiển thị cho bệnh nhân.
3. Staff workspace cố định một clinic; hiển thị vai trò và lọc địa điểm được cấp quyền trong workflow, không dùng clinic/branch làm context-switch chính.
4. Appointment is not an encounter. Walk-in starts at front desk, not public booking.
5. Queue code, appointment code, patient code, encounter code, invoice code are labeled separately.
6. Billing is independent of clinical signing; online success is never inferred from return URL alone.
7. Patient mobile-first; staff desktop-first, responsive without hiding essential actions; keyboard navigation.

## Website A — Public của phòng khám + tài khoản bệnh nhân

```
/public (hoặc /)
├── Giới thiệu (#about)
├── Dịch vụ và giá công khai (#services)
├── Đội ngũ bác sĩ công khai (#doctors)
├── Hướng dẫn đặt lịch (#guide, #faq)
├── Địa chỉ và giờ hoạt động (#contact)
├── Đặt lịch (/public/booking)
│   ├── Bác sĩ, dịch vụ, ngày và giờ trống; địa điểm duy nhất chọn sẵn
│   ├── Đăng nhập/đăng ký chung; kiểm tra hồ sơ bệnh nhân
│   ├── Giữ giờ có TTL, xem giá snapshot, xác nhận không cọc
│   └── Phục hồi giờ đang giữ; đổi/hủy theo quyền và trạng thái nguồn
└── Tài khoản bệnh nhân (/public/account)
    ├── Hồ sơ của tôi
    ├── Lịch khám của tôi
    ├── Thông báo và lựa chọn nhắc lịch
    └── Lịch sử vận hành, biên nhận nội bộ, tái khám theo quyền nguồn

/login?area=public&next=booking|account — chung phiên với Workspace/Platform
```

Clinic công bố lấy từ nguồn Clinic, cấu hình bằng `VITE_PUBLIC_CLINIC_ID`. Nếu ID chưa cấu hình, chỉ chấp nhận nguồn có đúng một clinic công bố; không chọn ngầm clinic khác. Homepage chỉ đọc dữ liệu công khai. Thẻ dịch vụ/bác sĩ mở booking và chọn sẵn dữ liệu nguồn, không tạo booking trước khi bệnh nhân xác nhận.

## Website B — Clinic Workspace with mode-specific navigation

```
/workspace
├── Clinic cố định / menu theo role / bộ lọc branch trong workflow; access-denied / expired membership
├── Quản lý (Owner/Manager)
│   ├── Tổng quan vận hành / theo branch
│   ├── Hồ sơ cơ sở & chi nhánh, giờ hoạt động, chứng từ
│   ├── Nhân sự, membership, phân công, lịch bác sĩ
│   ├── Danh mục, bảng giá, publication preview
│   └── Báo cáo / cấu hình
├── Lễ tân
│   ├── Danh sách hôm nay (appointment, trạng thái, lý do)
│   ├── Tìm/đăng ký bệnh nhân; tạo walk-in
│   ├── Check-in & hàng đợi, điều phối / bác sĩ vắng
│   └── Thay đổi lịch có lý do / thông báo
├── Bác sĩ
│   ├── Worklist được phân công
│   ├── Encounter: tổng quan, sinh hiệu, bệnh án nháp
│   ├── Chỉ định → trả kết quả → review
│   ├── Chẩn đoán, kê đơn, dặn dò, tái khám
│   └── Xác nhận chuyên môn, công bố tài liệu theo quyền
├── Nhân sự cận lâm sàng (nếu được cấp quyền)
│   └── Worklist order được giao / nhập kết quả
├── Thu ngân
│   ├── Bills/charges; đặt cọc; phí thực tế
│   ├── Thu trực tiếp / trạng thái online xác thực / thu một phần
│   ├── Biên nhận, hoàn tiền có phê duyệt
│   └── Chốt ca & đối soát
└── Chế độ Platform Console (không phải clinic role)
    ├── Hồ sơ đăng ký cơ sở chờ duyệt
    ├── Công bố và tạm ngưng công bố
    ├── Theo dõi giao dịch và hỗ trợ nền tảng
    └── Audit nghiệp vụ quản trị, không có quyền bệnh án mặc định
```

## Wayfinding
- Public: điều hướng Giới thiệu/Dịch vụ/Bác sĩ/Liên hệ, CTA Đặt lịch khám, liên kết Tài khoản bệnh nhân; booking/tài khoản có đường quay về trang chủ.
- Staff: persistent sidebar + active role/branch header, task-focused title, summary counts, sticky task action only if it does not hide keyboard focus.
- Role switching changes navigation and data scope, not merely visual tab; prototype is a demo only and does not simulate access control.

## Responsive baseline [design target]
Public: 360–430 px mobile; 768 px tablet; ≥ 1280 px desktop. Staff: ≥1280 px primary, 768 px compact; critical forms usable at 390 px for contingency, data table collapses into list cards. Test at 200% and 400% zoom; no horizontal scroll in key form flows.

## References
- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- NHS digital service design system: https://service-manual.nhs.uk/design-system
- USWDS forms and date/time selection: https://designsystem.digital.gov/components/form/ ; https://designsystem.digital.gov/components/date-picker/


## Tham khảo cấu trúc Public — 2026-10-02

Đã xem homepage CarePlus, Victoria Healthcare và Family Medical Practice: tham khảo vị trí CTA đặt lịch, nhóm dịch vụ/bác sĩ, giới thiệu và thông tin đến khám. Giao diện và nội dung được viết riêng; không sao chép ảnh, logo, đánh giá hoặc thành tích y tế. Hình phòng khám hiện là SVG có nhãn “Minh họa”; doctor dùng avatar biểu tượng đến khi có ảnh được phép sử dụng. Dữ liệu địa chỉ/bác sĩ/dịch vụ local vẫn là dữ liệu mẫu.

- https://careplusvn.com/vi/
- https://www.victoriavn.com/en/
- https://www.vietnammedicalpractice.com/?lang=en

Kiểm chứng hiện tại: `docs/audits/clinic-v2/P05-S0-06/Public_Clinic_Website_Evidence.md`.
