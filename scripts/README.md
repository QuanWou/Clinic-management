# Scripts đang dùng cho 5 core

- `build-main.ps1`: clean build Maven reactor và frontend.
- `start.ps1` / `start-main.ps1`: chuyển tới `start-core.ps1`, chạy 5 core, API Gateway riêng và frontend.
- `stop.ps1` / `stop-main.ps1`: dừng các tiến trình được ghi nhận, kiểm tra quyền sở hữu PID.
- `runtime-peer-environment.ps1`: cấu hình địa chỉ module theo core.
- `verify-five-core.mjs`: đọc API qua gateway, kiểm tra quyền và module bệnh nhân/khám/thông báo.
- `verify-front-desk.mjs`, `verify-cashier-desk.mjs`: kiểm tra giao diện, chặn ghi nghiệp vụ.

Các script kiểm thử sandbox hoặc seed lịch sử khác được giữ để tham khảo; chưa được chuyển đầy đủ sang cấu trúc 5 core. Không dùng chúng để khởi động hay seed database vận hành. Launcher mới từ chối `-Seed`. Launcher và restart service đơn lẻ cũ được cất trong `.archive/before-five-core-20261005/superseded-tools`.
