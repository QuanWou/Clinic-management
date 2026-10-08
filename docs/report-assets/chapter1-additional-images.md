# Bổ sung hình minh họa Chương 1

Tạo bằng ImageGen tích hợp. Hình khái niệm, bám nội dung báo cáo, không phải ảnh giao diện.

Hiệu chỉnh cuối bằng ImageGen: bỏ mũi tên nối PostgreSQL tới ghi chú phiên bản ở hình Spring; đổi nhãn Request thành “Body JSON nếu cần”; đổi nhãn Inbox thành “Tiếp nhận / Chống trùng”.

## Hình 1.3. Giao tiếp đồng bộ và giao nhận có thể thử lại giữa các module.

[communication](D:/MainDV/Clinic-management/docs/report-assets/chapter1-communication.png)

Prompt cuối:

Use case: scientific-educational. Create one polished textbook illustration for a Vietnamese university software report. Landscape 1536x1024, pure white background, thin black outlines and arrows, very pale lavender fills, black Times New Roman style serif text at least 40px, accurate Vietnamese accents, generous even margins. Flat diagram, no shadows, gradients, decorative header, bullet dots, watermarks, logos or screenshots. Only render specified labels. Flow arrows must be correct, no duplicate nodes. Caption will be outside image.
Two wide separated horizontal lanes. Upper lane: box "Module gọi" arrow right to "Module nhận", arrow labeled "HTTP Request"; a separate reverse arrow below labeled "HTTP Response". Left lane label above "ĐỒNG BỘ". Lower lane: box "Module nguồn" arrow right to "Bản ghi giao nhận" arrow right to "Module đích". Above lower lane "GIAO NHẬN CÓ THỂ THỬ LẠI". Beneath middle lower box a self-loop arrow labeled "Theo dõi / Thử lại". Bottom note "Mỗi module giữ ranh giới giao dịch riêng". No broker icons, no RabbitMQ, no exactly-once or shared global transaction.

## Hình 1.4. Trao đổi tài nguyên qua RESTful API.

[rest](D:/MainDV/Clinic-management/docs/report-assets/chapter1-rest.png)

Prompt cuối:

Use case: scientific-educational. Create one polished textbook illustration for a Vietnamese university software report. Landscape 1536x1024, pure white background, thin black outlines and arrows, very pale lavender fills, black Times New Roman style serif text at least 40px, accurate Vietnamese accents, generous even margins. Flat diagram, no shadows, gradients, decorative header, bullet dots, watermarks, logos or screenshots. Only render specified labels. Flow arrows must be correct, no duplicate nodes. Caption will be outside image.
Left box "CLIENT"; right box "REST API"; a database cylinder below right box "Tài nguyên". Two separate arrows: upper CLIENT to REST API label "GET /appointments/{id}", lower REST API to CLIENT label "200 OK / JSON". Arrow REST API to cylinder label "Đọc dữ liệu". At bottom three equal small boxes "URI tài nguyên", "Giao diện thống nhất", "Request tự chứa ngữ cảnh". No additional text. Diagram of general resource exchange, no hypermedia compliance claim.

## Hình 1.5. Quan hệ giữa tổ chức dịch vụ SOA và giao tiếp qua API.

[soa-rest](D:/MainDV/Clinic-management/docs/report-assets/chapter1-soa-rest.png)

Prompt cuối:

Use case: scientific-educational. Create one polished textbook illustration for a Vietnamese university software report. Landscape 1536x1024, pure white background, thin black outlines and arrows, very pale lavender fills, black Times New Roman style serif text at least 40px, accurate Vietnamese accents, generous even margins. Flat diagram, no shadows, gradients, decorative header, bullet dots, watermarks, logos or screenshots. Only render specified labels. Flow arrows must be correct, no duplicate nodes. Caption will be outside image.
Top box "Client"; below a horizontal bar "Hợp đồng HTTP API"; Client arrow to bar. Under bar three boxes in one row "Appointment", "Patient / Medical", "Billing", each with own arrow down from bar. Beneath all three a single spanning pale band "SOA: phân chia trách nhiệm nghiệp vụ". Footer "API: quy định cách trao đổi dữ liệu". No arrows between the three services. Distinguish SOA organizing services and HTTP API communication.

## Hình 1.6. Các thành phần định danh tài nguyên trên endpoint.

[endpoint](D:/MainDV/Clinic-management/docs/report-assets/chapter1-endpoint.png)

Prompt cuối:

Use case: scientific-educational. Create one polished textbook illustration for a Vietnamese university software report. Landscape 1536x1024, pure white background, thin black outlines and arrows, very pale lavender fills, black Times New Roman style serif text at least 40px, accurate Vietnamese accents, generous even margins. Flat diagram, no shadows, gradients, decorative header, bullet dots, watermarks, logos or screenshots. Only render specified labels. Flow arrows must be correct, no duplicate nodes. Caption will be outside image.
A wide horizontal URI strip containing four separate sequential compartments exactly "/s1" | "/appointment" | "/api/appointments" | "/{id}". Above strip centered "GET /s1/appointment/api/appointments/{id}". Beneath each compartment a downward connector to label respectively "Alias Client", "Module", "Tập tài nguyên", "Định danh". At bottom two short separate centered notes "URI xác định tài nguyên" and "HTTP method xác định thao tác". Do not break URI text, no extra endpoint.

## Hình 1.7. Ý nghĩa của các phương thức HTTP đối với tài nguyên.

[methods](D:/MainDV/Clinic-management/docs/report-assets/chapter1-methods.png)

Prompt cuối:

Use case: scientific-educational. Create one polished textbook illustration for a Vietnamese university software report. Landscape 1536x1024, pure white background, thin black outlines and arrows, very pale lavender fills, black Times New Roman style serif text at least 40px, accurate Vietnamese accents, generous even margins. Flat diagram, no shadows, gradients, decorative header, bullet dots, watermarks, logos or screenshots. Only render specified labels. Flow arrows must be correct, no duplicate nodes. Caption will be outside image.
A central database cylinder labeled "Tài nguyên". Around it five balanced large cards labeled exactly "GET / Đọc", "POST / Tạo hoặc thực hiện lệnh", "PUT / Thay thế", "PATCH / Sửa một phần", "DELETE / Xóa". Clear arrows: cylinder outward to GET, other four inward to cylinder. Footer "POST và PATCH không mặc định lũy đẳng". No safety icons, no table, no duplicate labels.

## Hình 1.8. Thành phần Request và Response khi trao đổi dữ liệu JSON.

[json](D:/MainDV/Clinic-management/docs/report-assets/chapter1-json.png)

Prompt cuối:

Use case: scientific-educational. Create one polished textbook illustration for a Vietnamese university software report. Landscape 1536x1024, pure white background, thin black outlines and arrows, very pale lavender fills, black Times New Roman style serif text at least 40px, accurate Vietnamese accents, generous even margins. Flat diagram, no shadows, gradients, decorative header, bullet dots, watermarks, logos or screenshots. Only render specified labels. Flow arrows must be correct, no duplicate nodes. Caption will be outside image.
Two side-by-side large panels. Left title "REQUEST" and three separated wide internal blocks "Method / URI", "Headers", "Body JSON". Right title "RESPONSE" and three blocks "HTTP status", "Headers", "Body JSON nếu có". Top small Client label on left and Server label on right. Arrow above panels pointing right label "Gửi yêu cầu"; arrow below pointing left label "Nhận kết quả". Footer "Không phải mọi phản hồi đều có body". No JSON code or personal data.

## Hình 1.9. Phân nhóm mã trạng thái HTTP và hướng xử lý tại Client.

[status](D:/MainDV/Clinic-management/docs/report-assets/chapter1-status.png)

Prompt cuối:

Use case: scientific-educational. Create one polished textbook illustration for a Vietnamese university software report. Landscape 1536x1024, pure white background, thin black outlines and arrows, very pale lavender fills, black Times New Roman style serif text at least 40px, accurate Vietnamese accents, generous even margins. Flat diagram, no shadows, gradients, decorative header, bullet dots, watermarks, logos or screenshots. Only render specified labels. Flow arrows must be correct, no duplicate nodes. Caption will be outside image.
Three equally wide columns with pale headers "2xx", "4xx", "5xx". Within first column three neatly separated rows "200: có kết quả", "201: tạo mới", "204: không body". Within second four rows "400: dữ liệu sai", "401: xác thực", "403: bị từ chối quyền", "409: xung đột". Within third two rows "500: lỗi xử lý", "503: chưa sẵn sàng". Beneath columns spanning footer "Lỗi mạng hoặc 5xx: đối chiếu kết quả thao tác ghi". Text large, black, no check marks, no bullets, no arrows.

## Hình 1.11. Phân tầng xử lý yêu cầu trong ứng dụng Spring Boot.

[spring](D:/MainDV/Clinic-management/docs/report-assets/chapter1-spring.png)

Prompt cuối:

Use case: scientific-educational. Create one polished textbook illustration for a Vietnamese university software report. Landscape 1536x1024, pure white background, thin black outlines and arrows, very pale lavender fills, black Times New Roman style serif text at least 40px, accurate Vietnamese accents, generous even margins. Flat diagram, no shadows, gradients, decorative header, bullet dots, watermarks, logos or screenshots. Only render specified labels. Flow arrows must be correct, no duplicate nodes. Caption will be outside image.
Five wide boxes stacked vertically with one downward arrow between neighbors: "HTTP Request", "Controller / Kiểm tra đầu vào", "Service / Quy tắc nghiệp vụ", "Tầng truy cập dữ liệu", "PostgreSQL". Pale enclosing outline around middle three labeled at side "Spring Boot". At bottom "Java 21 / Spring Boot 3.3.5". No claim Gateway has database, no icons, no response arrows.

## Hình 1.12. Quan hệ giữa component React, lớp API và trạng thái giao diện.

[react](D:/MainDV/Clinic-management/docs/report-assets/chapter1-react.png)

Prompt cuối:

Use case: scientific-educational. Create one polished textbook illustration for a Vietnamese university software report. Landscape 1536x1024, pure white background, thin black outlines and arrows, very pale lavender fills, black Times New Roman style serif text at least 40px, accurate Vietnamese accents, generous even margins. Flat diagram, no shadows, gradients, decorative header, bullet dots, watermarks, logos or screenshots. Only render specified labels. Flow arrows must be correct, no duplicate nodes. Caption will be outside image.
Four boxes arranged in clockwise square: top left "Component React", top right "Lớp API / Fetch", bottom right "HTTP API", bottom left "State / Kết quả". Arrows top left to top right "Thao tác"; top right down to bottom right "Request"; bottom right to bottom left "Response"; bottom left up to top left "Cập nhật". Short footer "TypeScript mô tả kiểu dữ liệu". No UI mockup, Axios, Redux, extra paths or invented token refresh.

## Hình 1.13. Quản lý thay đổi cấu trúc PostgreSQL bằng Flyway.

[postgres](D:/MainDV/Clinic-management/docs/report-assets/chapter1-postgres.png)

Prompt cuối:

Use case: scientific-educational. Create one polished textbook illustration for a Vietnamese university software report. Landscape 1536x1024, pure white background, thin black outlines and arrows, very pale lavender fills, black Times New Roman style serif text at least 40px, accurate Vietnamese accents, generous even margins. Flat diagram, no shadows, gradients, decorative header, bullet dots, watermarks, logos or screenshots. Only render specified labels. Flow arrows must be correct, no duplicate nodes. Caption will be outside image.
Left stack of three document shapes, labels "V1__init.sql", "V2__update.sql", "V3__extend.sql"; three arrows into centered box "Flyway / Migration"; one arrow right into large cylinder "PostgreSQL". Below Flyway note "Theo thứ tự phiên bản". Below cylinder note "Schema / Ràng buộc dữ liệu". Footer "Migration được ghi nhận trong lịch sử". Filenames are conceptual examples, not project actual files. No MySQL or logo.

## Hình 1.14. Xác thực JWT và kiểm tra quyền tại module nghiệp vụ.

[jwt](D:/MainDV/Clinic-management/docs/report-assets/chapter1-jwt.png)

Prompt cuối:

Use case: scientific-educational. Create one polished textbook illustration for a Vietnamese university software report. Landscape 1536x1024, pure white background, thin black outlines and arrows, very pale lavender fills, black Times New Roman style serif text at least 40px, accurate Vietnamese accents, generous even margins. Flat diagram, no shadows, gradients, decorative header, bullet dots, watermarks, logos or screenshots. Only render specified labels. Flow arrows must be correct, no duplicate nodes. Caption will be outside image.
Horizontal flow with four boxes: "Client" to "Gateway / Chuyển tiếp" to "Module / Xác minh JWT" to "Kiểm tra quyền và scope". Over first arrow label "Bearer token". From final box arrow down to fifth box below "Xử lý nghiệp vụ nếu được phép". Below Gateway a short centered note "Không sở hữu khóa ký". Footer "Danh tính hợp lệ vẫn cần được kiểm tra quyền". No automatic ADMIN privilege or all-requests authorization at Gateway.

## Hình 1.15. Hai cách truy cập PostgreSQL qua JPA và JDBC.

[jpa-jdbc](D:/MainDV/Clinic-management/docs/report-assets/chapter1-jpa-jdbc.png)

Prompt cuối:

Use case: scientific-educational. Create one polished textbook illustration for a Vietnamese university software report. Landscape 1536x1024, pure white background, thin black outlines and arrows, very pale lavender fills, black Times New Roman style serif text at least 40px, accurate Vietnamese accents, generous even margins. Flat diagram, no shadows, gradients, decorative header, bullet dots, watermarks, logos or screenshots. Only render specified labels. Flow arrows must be correct, no duplicate nodes. Caption will be outside image.
Top centered box "Service". It branches diagonally into two same-size middle boxes: left "JPA / Hibernate" with second line "Entity / Repository"; right "JDBC / JdbcTemplate" second line "SQL tường minh". Both branch boxes arrows down into one centered large cylinder "PostgreSQL". Footer "Chọn cách truy cập theo từng module". No arrows between JPA and JDBC, no universal ORM claim, no logos.

## Hình 1.16. Công cụ build và kiểm thử cho Backend và Frontend.

[build-test](D:/MainDV/Clinic-management/docs/report-assets/chapter1-build-test.png)

Prompt cuối:

Use case: scientific-educational. Create one polished textbook illustration for a Vietnamese university software report. Landscape 1536x1024, pure white background, thin black outlines and arrows, very pale lavender fills, black Times New Roman style serif text at least 40px, accurate Vietnamese accents, generous even margins. Flat diagram, no shadows, gradients, decorative header, bullet dots, watermarks, logos or screenshots. Only render specified labels. Flow arrows must be correct, no duplicate nodes. Caption will be outside image.
Two parallel lanes side by side with four large cards each and downward arrows within each lane. Left lane cards "BACKEND", "Maven", "JUnit / Kiểm thử", "JAR / Đóng gói". Right lane cards "FRONTEND", "Node.js / Vite", "Vitest / Kiểm thử", "dist / Build". At bottom spanning note "Build thành công không thay thế kiểm thử tích hợp". No test counts, production/cloud/Docker claims, no logos.

## Hình 1.17. Vai trò của outbox, delivery và inbox trong giao nhận nội bộ.

[outbox](D:/MainDV/Clinic-management/docs/report-assets/chapter1-outbox.png)

Prompt cuối:

Use case: scientific-educational. Create one polished textbook illustration for a Vietnamese university software report. Landscape 1536x1024, pure white background, thin black outlines and arrows, very pale lavender fills, black Times New Roman style serif text at least 40px, accurate Vietnamese accents, generous even margins. Flat diagram, no shadows, gradients, decorative header, bullet dots, watermarks, logos or screenshots. Only render specified labels. Flow arrows must be correct, no duplicate nodes. Caption will be outside image.
Three boxes left to right: "Outbox / Lưu yêu cầu", "Delivery / Gửi và thử lại", "Inbox / Ghi nhận nhận". Single arrows left to right. From Inbox arrow down into fourth wide box "Xử lý có kiểm soát chống lặp". Short footer "Luồng minh họa khái niệm giao nhận nội bộ". No RabbitMQ, Kafka, broker, exactly-once guarantee or atomic across all services claim. Draw one retry self-arrow on Delivery with short label "Thử lại".

