# 04 — E2E test blueprint (chưa thực thi)

**Mục tiêu:** chứng minh nghiệp vụ hoạt động xuyên client/BFF/services/DB/events/notifications, không chỉ test UI hoặc riêng endpoint. Mọi test hiện `NOT RUN` và phải dùng **dữ liệu tổng hợp**, payment provider sandbox. Tiêu chí nguồn: Phase 02 `AT-001…068`, `E2E-ONLINE`, `E2E-WALKIN`; Phase 03 `ARCH-01…16`; Phase 04 `UX-A01…25`.

## Quy tắc chạy
- Dựng synthetic clinic A có hai branch và clinic B độc lập; hai staff nhiều membership; patient P1, P2, guardian G (verified/revoked); doctor A/B. Không upload ảnh hay hồ sơ của bệnh nhân thật.
- Lưu `build_id`, version contracts, tenant/branch, id test, correlation ID, test fixture, actor, thời gian, expected/actual, screenshot đã ẩn PII, log redacted, truy vấn kiểm chứng state qua service owner, outcome và issue ID.
- Làm sạch fixture sau test theo quy tắc giữ audit (không DELETE dữ liệu thật); dùng sandbox provider callback hợp lệ/giả lập provider có ký đúng theo contract.
- Không đánh dấu PASS khi chỉ thấy UI thông báo thành công; xác minh source-of-truth và quan hệ bảng/ledger khi có thể.

## Test journey J-01 — Online appointment → aftercare (gate bắt buộc)
| Step | Actor | Action | Assertion bắt buộc | AT/UX |
|---|---|---|---|---|
| 01 | Platform/Owner | Duyệt và công bố A; B còn draft | Search chỉ trả A; B không booking được | AT-001/002/050; UX-A09 |
| 02 | Patient P1 | Search → chọn A/branch1/doctor/service | Địa chỉ/giá/lịch public đúng; không thấy lịch nhân sự nội bộ | AT-050–052; UX-A01/02 |
| 03 | P1 | Đăng ký, xác minh liên kết patient | Lịch sở hữu đúng P1, không lộ hồ sơ người khác | AT-046/047/053 |
| 04 | P1 | Xem availability, hold slot | Hold có TTL/capacity và price snapshot; hai session không cùng lấy slot capacity=1 | AT-005–007/053; UX-A03/04 |
| 05 | P1 | Confirm, nhánh no-deposit hoặc approved deposit | Có appointment code khác queue/encounter; pending money không hiện success | AT-008/053; UX-A05 |
| 06 | Receptionist | Check-in khi đến; tạo ticket | Một check-in/ticket active; branch/doctor đúng | AT-010/011; UX-A11/13 |
| 07 | Doctor | Start encounter, lưu draft, chỉ định test | Assignment hợp lệ; order `ordered`, encounter `awaiting_results` | AT-011/012/058; UX-A14/15 |
| 08 | Lab → Doctor | Return result, doctor review | Result có author; chưa review không clinically complete | AT-013/023 |
| 09 | Doctor | Diagnosis, prescription, sign/release | Mandatory valid, version immutable, release riêng | AT-014/015/059/061; UX-A16/17 |
| 10 | Billing/Cashier/P1 | Verify final bill, apply deposit, pay remaining online hoặc tại quầy | Unique charge, no double deposit; ledger beneficiary đúng; receipt correct | AT-016–019/021/062/063 |
| 11 | P1 | Portal xem tài liệu/bill; nhận reminder | Chỉ released documents; notification không lộ PHI | AT-022/034/037; UX-A07 |
| 12 | Doctor/P1 | Follow-up plan → đặt lịch mới | New appointment, linked previous visit; signed encounter cũ không bị sửa | `AT-E2E-FOLLOWUP` đề xuất; review trước baseline |

**Nhánh online payment:** với OD-01/02/03 chưa chốt, được mô tả để test ở sandbox, không khẳng định merchant/fee/refund policy hợp pháp hay đã triển khai. Đối với đặt cọc, payment success sau TTL không chiếm lại slot của người khác; exception/refund được theo dõi (AT-042).

## Test journey J-02 — Walk-in không tài khoản, không booking (gate bắt buộc)
| Step | Actor | Action | Assertion | AT/UX |
|---|---|---|---|---|
| 01 | Receptionist | Chọn A/branch2; tìm bệnh nhân theo dữ liệu nhập tại quầy | Chỉ thấy hành chính cần thiết; gợi ý trùng không tự merge | AT-009/044; UX-A12 |
| 02 | Receptionist | Tạo provisional patient và walk-in encounter | `appointment_id=null`; không yêu cầu đăng ký web | AT-009/047 |
| 03 | Receptionist | Check-in, cấp/điều phối ticket | Một active ticket đúng ngày, branch, service point | AT-010/056 |
| 04 | Doctor assigned | Khám, order/result/review, kê đơn/sign | Encounter và signed record đúng owner/version | AT-011–015/028 |
| 05 | Cashier | Thu trực tiếp hoặc partial; in chứng từ | Lưu người thu/ca; remaining đúng; chứng từ gắn đúng lượt | AT-017/018/063 |
| 06 | Patient | Liên kết tài khoản sau khám qua xác minh phù hợp | Chỉ xem released docs/bill của mình, không tự nối hồ sơ do trùng số điện thoại | AT-022/044/047 |
| 07 | Receptionist/Doctor | Tạo lịch tái khám | Appointment mới có liên kết prior encounter; không bị ép sửa record cũ | `AT-E2E-FOLLOWUP` (đề xuất) |

## Additional E2E matrix (bắt buộc theo phần liên quan)
| ID | Trọng tâm | Expected result / nguồn |
|---|---|---|
| J-03 | Hai phiên tranh slot capacity=1; 50 attempts theo plan ARCH | Không quá capacity; hold leak=0; `AT-006/007`, `ARCH-04` |
| J-04 | Deposit paid after hold expiration | Không chiếm slot đã cấp; refund/manual queue, audit; `AT-042`, `ARCH-05` |
| J-05 | Cancel/reschedule, bác sĩ vắng, patient no-show | Có policy, nguồn tiền, lịch sử và notify; `AT-008/054/055/057` |
| J-06 | Result về sau chốt ca | Encounter awaiting_results giữ nguyên, report pending; `AT-013/023` |
| J-07 | Doctor outside assignment; signed document edit | Deny; addendum thay vì overwrite; `AT-028/041` |
| J-08 | Patient/guardian revoked and cross-tenant IDs | Deny read/write, no sensitive cached data; `AT-025/026/034/035/036/043/047` |
| J-09 | Payment forged webhook, replay, timeout | Reject forged, one financial effect for replay, unknown reconciles; `AT-029/030/031/039` |
| J-10 | Partial/direct/online concurrent, refund replay | Không double collect/refund; ledger balance; `AT-018/020/021/032/033/064/065` |
| J-11 | Search delay, clinic suspension, stale price | Source revalidate; no booking suspended; historical snapshot stable; `AT-003/016/045/050` |
| J-12 | Restore + migration rehearsal | Record count, mapping, signed versions, totals reconciled; evidence; `AT-038/040/061` |
| J-13 | Notification provider failure | Retry/dedup, status not deceptive, no PHI preview; `AT-037/066` |
| J-14 | Membership revoke during queued workflow | Subsequent staff API denied even if JWT/tenant header cached; `AT-035/043/049` |

## Test types / evidence expectation
- **Contract:** request/response schema, version compatibility, signed/event envelopes, consumer with old/new event; every relevant endpoint has negative auth case.
- **Integration:** appointment+payment saga, outbox retry/inbox, Medical→Billing unique source charge, Portal→Medical download authorization.
- **Security:** IDOR, cross-tenant, wrong branch, revoked user/guardian, file URL guessing, PHI absent from logs/search/notifications; test server-side behavior.
- **Financial:** compare payment intent/provider trace/ledger/refund/settlement, by currency and beneficiary, not only rendered total.
- **Clinical:** role/assignment, mandatory fields, version signing, order result author/reviewer split, correct patient+visit and export/restore per medical-approved template.
- **Usability:** desktop reception and patient mobile, loading/error/empty/focus/keyboard/zoom, measured observation from real test participants. No invented usability score.
- **Performance/recovery:** load/SLA/RPO/RTO targets remain `[OPEN OD-09]`; measure on approved environment, not claim fixed thresholds without inputs.

## Execution and defect log template
| Test ID | Env/build | Actor/fixture | Expected | Actual | Status `NOT RUN/PASS/FAIL/BLOCKED` | Evidence/redaction | Defect | Owner | Approval |
|---|---|---|---|---|---|---|---|---|---|
| J-01 | TBD | Synthetic A/P1 | Per step 01–12 | TBD | NOT RUN | TBD | — | QA | — |

**Gate:** J-01 and J-02 PASS end-to-end + all relevant P0/negative tests PASS; no unapproved financial/medical/privacy blocker; all GATE-A–E and ARCH-01–16 evidence reviewed as applicable. `BLOCKED` is not equivalent to `PASS`. If OD issue prevents real payment/EMR legality, mark production gate `NO-GO` until signed resolution.
