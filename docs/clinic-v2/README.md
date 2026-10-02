# Clinic Management V2 — Bộ tài liệu hợp nhất P01–P05

**Phiên bản tập hợp:** 2026-09-29 · **Mục đích:** đưa cùng một baseline thiết kế vào repository để nghiên cứu, audit và triển khai về sau.  
**Trạng thái:** TÀI LIỆU / KẾ HOẠCH; **chưa triển khai V2, chưa audit đầy đủ V1, chưa duyệt các quyết định OPEN, chưa có kết quả E2E**.  
**Phạm vi đã chốt:** Marketplace + SaaS · phòng khám đa khoa · khám ngoại trú · thu tại cơ sở và online.

## Đọc trước

1. [`00_PROJECT_CONTEXT.md`](00_PROJECT_CONTEXT.md) — bối cảnh thống nhất, sản phẩm, business invariants, yêu cầu giữ nguyên.
2. [`00_DOCUMENT_MAP.md`](00_DOCUMENT_MAP.md) — nơi tra từng nhóm quyết định/contract/UX/test; quy tắc nguồn sự thật.
3. [`00_DECISIONS_AND_GATES.md`](00_DECISIONS_AND_GATES.md) — điều đã LOCKED và 12 quyết định OPEN.
4. [`00_REPOSITORY_HANDOFF.md`](00_REPOSITORY_HANDOFF.md) — cách đưa vào repo và cách bắt đầu Phase 05 mà không phá V1.
5. [`05_Implementation_Delivery/03_Implementation_Backlog.md`](05_Implementation_Delivery/03_Implementation_Backlog.md) — backlog thực hiện theo vertical slices.

## Gói giữ nguyên chi tiết từng phần

- [`01_Product_Research/`](01_Product_Research/) — khảo sát và quy trình.
- [`02_Product_Requirements/`](02_Product_Requirements/) — PRD, permissions, acceptance, decision log.
- [`03_Architecture_and_Database/`](03_Architecture_and_Database/) — architecture, tenancy, ERD, API/event contracts, lifecycle, sơ đồ, SQL tham chiếu.
- [`04_UX_UI_and_Prototypes/`](04_UX_UI_and_Prototypes/) — UX/UI, sitemap, design system và prototype HTML (demo only).
- [`05_Implementation_Delivery/`](05_Implementation_Delivery/) — 12 tài liệu P05 và backlog.csv; task PLANNED, test NOT RUN.

Điểm vào prototype: [`04_UX_UI_and_Prototypes/index.html`](04_UX_UI_and_Prototypes/index.html). Dữ liệu prototype là **giả lập**, không phải chức năng đã kết nối API.

**Tính toàn vẹn:** `MANIFEST_SHA256.txt` kiểm tra toàn bộ file trong gói (trừ chính manifest). `MANIFEST_Phase01-04_ORIGINAL.txt` giữ manifest đầu vào để đối chứng; manifest gốc còn liệt kê 4 ZIP độc lập không được lồng trong gói P01–P04 cung cấp, nhưng cả 72 file nội dung liệt kê trong gói đều có hash đúng. `README_Phase01-04_ORIGINAL.md` giữ lời giới thiệu gốc. README P05 được lưu nguyên văn tại `05_Implementation_Delivery/README.md`. Không sửa nội dung source của các phase.

**Không chạy** các file `sql/*.sql` trên DB V1; chúng là mẫu tham chiếu thiết kế. Không tự chạy `_generate_contracts.py` khi nhập gói. Không coi `openapi.yaml` là bản bao phủ đầy đủ mọi route P0. Tài liệu chưa thay thế thẩm định y khoa, bảo mật, tài chính và pháp lý trước khi vận hành thật.
