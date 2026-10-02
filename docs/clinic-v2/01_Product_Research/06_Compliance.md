# 06 — Compliance and Data Governance
Bản checklist kỹ thuật, không phải kết luận pháp lý hoặc chứng nhận tuân thủ.

## Nguồn chính thức
- Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 (hiệu lực 01/01/2026): https://vbpl.vn/tw/Pages/vbpq-thuoctinh.aspx?ItemID=179252
- Nghị định 356/2025/NĐ-CP (hiệu lực 01/01/2026): https://vbpl.vn/TW/Pages/vbpq-toanvan.aspx?ItemID=187276
- Thông tư 13/2025/TT-BYT (hiệu lực 21/07/2025): https://vbpl.vn/boyte/Pages/vbpq-toanvan.aspx?ItemID=178219
- Nghị định 96/2023/NĐ-CP và Luật Khám bệnh, chữa bệnh 2023: cần đối chiếu phiên bản và phạm vi áp dụng trước go-live.

## Ma trận yêu cầu [VERIFY với chuyên gia pháp chế/y tế]
- Căn cứ xử lý dữ liệu, thông báo minh bạch, quyền chủ thể dữ liệu và xử lý yêu cầu.
- Dữ liệu sức khỏe nhạy cảm: phân loại, tối thiểu hóa, kiểm soát truy cập, mã hóa, lưu vết.
- Vai trò bên kiểm soát/xử lý dữ liệu giữa nền tảng, phòng khám, đối tác thanh toán; hợp đồng và chuyển dữ liệu.
- Vòng đời bệnh án điện tử: lập, cập nhật, hiển thị, ký/xác nhận, lưu trữ, khai thác; thời hạn và lộ trình áp dụng.
- Chứng từ tài chính, hoàn tiền, đối soát và nghĩa vụ hóa đơn cần đối chiếu riêng.
- Sự cố dữ liệu, sao lưu/khôi phục, nhật ký bất biến, phân quyền nhân sự và chấm dứt hợp tác.
- Public search chỉ công bố thông tin được phép; không index dữ liệu bệnh nhân.

## Security acceptance
Cross-tenant read/write test; broken object-level authorization; revoked staff access; audit tampering; encrypted backups; webhook replay; signed-record edit; guardian access; consent withdrawal handling.
