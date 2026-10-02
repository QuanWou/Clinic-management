# Repository handoff — cách thêm bộ tài liệu vào source project

## Bố trí được đề xuất

Gói ZIP đã chứa thư mục `docs/clinic-v2/` ở cấp root. **Giải nén từ repository root** sẽ thêm V2 song song với `docs/` V1 hiện có, không ghi đè `frontend/src`, backend code hay dữ liệu. Nếu chỉ upload ZIP làm Project knowledge, giữ cả bộ và bắt đầu đọc `docs/clinic-v2/README.md` và `00_PROJECT_CONTEXT.md`.

```text
<repository-root>/
  backend/                 # V1: GIỮ NGUYÊN
  frontend/                # V1: GIỮ NGUYÊN
  docs/
    ...                    # tài liệu V1 hiện có
    clinic-v2/
      README.md
      00_PROJECT_CONTEXT.md
      00_DOCUMENT_MAP.md
      00_DECISIONS_AND_GATES.md
      00_REPOSITORY_HANDOFF.md
      01_Product_Research/
      02_Product_Requirements/
      03_Architecture_and_Database/
      04_UX_UI_and_Prototypes/
      05_Implementation_Delivery/
      MANIFEST_SHA256.txt
```

**Không chép tài liệu này vào `frontend/src/` hay `backend/*/src/`**: đây là tài liệu/product prototype, không phải mã app. Nếu repository yêu cầu cấu trúc khác, đổi vị trí sau khi kiểm tra link/manifest.

## Bước thực hiện sau khi thêm

1. Chỉ xác nhận file đầy đủ/đúng hash và rà soát thứ tự nguồn sự thật ở `00_DOCUMENT_MAP.md`.
2. Chạy **P05-S0-01: source audit V1 read-only**: inventory service/schema/API/event/routes, hiện trạng auth/tenant, lifecycle/queue/billing/clinical UI; ghi evidence và diff so với P02–P04.
3. Lập bảng cho từng service/UI: `REUSE / REFACTOR / REPLACE / NEW`, mức rủi ro, dependent FR, migration, acceptance tests; giải quyết các quyết định OPEN cần cho S0/S1.
4. Chỉ khi có phê duyệt thực hiện mới tạo V2 code ở nhánh/thư mục/worktree được chỉ định; các giao diện V1 và DB/volumes phải được giữ an toàn, không làm đứt môi trường đang chạy hoặc task khác.
5. Bất kỳ thay đổi nhánh Git, commit/push, migration dữ liệu, di chuyển/xóa source đều cần yêu cầu cụ thể; không xem việc import tài liệu là lệnh triển khai.

## Lưu ý tài liệu/đường dẫn

- P01–P04 và P05 được giữ nguyên nội dung, chỉ đặt P05 vào thư mục `05_Implementation_Delivery`.
- `README_Phase01-04_ORIGINAL.md` và `MANIFEST_Phase01-04_ORIGINAL.txt` lưu nguyên từ gói đầu; manifest mới áp dụng toàn bộ gói hợp nhất.
- `03_Architecture_and_Database/references/Phase02_PRD/` giữ snapshot trùng để truy xuất nguồn; không có nghĩa là một bản PRD khác được ưu tiên.
- `03_Architecture_and_Database/sql/*.sql` là DDL minh họa, tuyệt đối không dùng như migration V1.
- Tài liệu P03 đôi chỗ gọi mẫu `sql/tenancy_reference.sql`; file thực trong gói là `sql/01_tenancy_reference.sql`. Ưu tiên xác minh file hiện có và mở issue tài liệu nếu cần, không tự suy ra đường dẫn mới khi chạy script.
