# Hình minh họa Chương 1

Tạo bằng công cụ ImageGen tích hợp. Hình minh họa khái niệm và các thành phần thực tế của Clinic-management, theo bố cục Chương 1 trong hướng dẫn viết báo cáo.

## Hình 1.1. Mô hình Client–Server và trao đổi dữ liệu qua API.

[chapter1-client-server.png](D:/MainDV/Clinic-management/docs/report-assets/chapter1-client-server.png)

Prompt cuối:

Create a crisp academic educational diagram for a Vietnamese university software report, landscape 1536x1024. Pure white background, Times New Roman style black serif typography, all labels large 40px minimum, black thin outlines, very pale lavender fills, no decorative title (caption will be external), no logos, no gradients, no shadows, generous whitespace, accurate Vietnamese accents. Draw a simple browser/laptop on left labeled "CLIENT" then second line "React / TypeScript", a rectangular server on right labeled "SERVER" then "Spring Boot", and a database cylinder beneath server labeled "PostgreSQL". Two distinct horizontal arrows between Client and Server, top arrow LEFT TO RIGHT labeled "HTTP Request", lower arrow RIGHT TO LEFT labeled "HTTP Response / JSON". One double directional vertical line between Server and PostgreSQL labeled "Đọc / ghi dữ liệu". Beneath Client add exactly two short lines "Giao diện người dùng" and "Hiển thị kết quả"; beneath server add "Kiểm tra quyền" and "Xử lý nghiệp vụ". Educational diagram has only these elements and text. Avoid screenshot UI, stock photo, bullet lists, paragraph prose, extra nodes. Arrange to fill central 80 percent of canvas with print legibility.

## Hình 1.2. Tổ chức các dịch vụ nghiệp vụ trong hệ thống phòng khám.

[chapter1-soa.png](D:/MainDV/Clinic-management/docs/report-assets/chapter1-soa.png)

Prompt cuối:

Create a precise Vietnamese academic conceptual service-oriented architecture diagram, landscape 1536x1024, pure white, black Times New Roman style serif labels at least 40px, pale lavender boxes, thin black arrows, no gradients/icons/shadows, no header title because caption is external. At top center one box "Ứng dụng Client". Below it one box "API Gateway". Gateway fans out to FIVE equal core boxes in a balanced 3 + 2 grid: "Identity" subline "Định danh / Phân quyền"; "Doctor" subline "Phòng khám / Bác sĩ"; "Patient" subline "Bệnh nhân / Hồ sơ khám"; "Appointment" subline "Lịch hẹn / Lượt khám"; "Billing" subline "Viện phí / Thông báo". Each core box also has the same short smaller subline "API riêng". Use a bus from Gateway with a single arrow down to each of the five core boxes, no arrows connecting cores with each other. Five boxes only, distinct, no duplicates. At bottom two centered notes "Giao tiếp thông qua hợp đồng API" and "Mỗi module quản lý dữ liệu nghiệp vụ của mình". No port numbers, no Java launch details, no SQL nodes, no other technology. Large text with accurate Vietnamese diacritics, sober clean textbook figure filling central 80 percent of canvas with even margins.

## Hình 1.3. Chu trình gửi yêu cầu và xử lý phản hồi API tại Client.

[chapter1-api-cycle.png](D:/MainDV/Clinic-management/docs/report-assets/chapter1-api-cycle.png)

Prompt cuối:

Draw a clean textbook flow diagram for a Vietnamese academic report on consuming HTTP APIs. Landscape 1536x1024, white background, Times New Roman style black serif font, all labels at least 40px, thin black arrows, pale lavender rounded rectangles, no shading, no photos, no decorative title. Use six boxes in two rows of three forming a continuous snake: top left "Thao tác người dùng", top middle "Chuẩn bị Request", top right "Gửi qua Fetch API"; arrow top right downward to bottom right "Nhận HTTP Response", arrow bottom right leftward to bottom middle "Kiểm tra status / lỗi", arrow bottom middle leftward to bottom left "Cập nhật giao diện". From bottom left back upward to top left use a subtle connector arrow along left margin closing the cycle. At top middle box a short separate note below it "Token / JSON / Khóa chống lặp" is allowed but not a bullet list; typeset as one centered line. Bottom footer centered: "Đọc lại dữ liệu sau khi thao tác ghi được xác nhận". Do not invent auto-refresh token, Axios or a success envelope. Exactly six boxes, label text verbatim with proper accents, all connector direction correct, large clear print figure. No numbered list, no extra labels.

## Hình 1.4. Ngăn xếp công nghệ sử dụng trong hệ thống.

[chapter1-stack.png](D:/MainDV/Clinic-management/docs/report-assets/chapter1-stack.png)

Prompt cuối:

Create a formal academic Vietnamese software technology stack illustration for a university report. Landscape 1536x1024, white background, thin black outlines, Times New Roman style black serif text, pale lavender fill on four very wide horizontal layers separated by 24px. All text at least 42px, no logos/icons, no shadows/gradient, no title outside layers. Four layer boxes from top to bottom, each centered two lines: top "GIAO DIỆN VÀ TIÊU THỤ API" / "React / TypeScript / Fetch API"; second "XỬ LÝ NGHIỆP VỤ" / "Java 21 / Spring Boot 3.3.5"; third "DỮ LIỆU VÀ MIGRATION" / "PostgreSQL / Flyway"; fourth "BUILD VÀ KIỂM THỬ" / "Maven / Vite / JUnit / Vitest". Connect first three layers with small downward arrows centered between them. Build/test layer under a light separating gap, no arrow implying business data flows into testing. Exact text and versions only. Aim a sober flat textbook chart, no bullet lists or added technology, very legible printed at width six inches.

