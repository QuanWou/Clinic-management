export const stateNames:Record<string,string>={
 DRAFT:'Bản nháp',SUBMITTED:'Chờ duyệt',NEEDS_CHANGES:'Cần bổ sung',APPROVED:'Đã duyệt',REJECTED:'Đã từ chối',UNPUBLISHED:'Chưa công bố',PUBLISHED:'Đang công bố',SUSPENDED:'Tạm ngưng công bố',
 CONFIRMED:'Đã xác nhận',CHECKED_IN:'Đã tiếp nhận',CANCELLED:'Đã hủy',FULFILLED:'Đã khám',COMPLETED:'Đã hoàn tất',EXPIRED:'Đã hết hạn',ACTIVE:'Đang hoạt động',INVITED:'Chờ chấp nhận',REVOKED:'Đã thu hồi',PROVISIONAL:'Hồ sơ tạm',VERIFIED:'Đã xác minh',
 ARRIVAL_PENDING:'Chờ xác nhận tiếp nhận',WAITING:'Chờ khám',CALLED:'Đã gọi',SERVING:'Đang khám',DONE:'Đã phục vụ',SKIPPED:'Đã bỏ qua',TRANSFERRED:'Đã chuyển phòng',IN_PROGRESS:'Đang khám',AWAITING_RESULTS:'Chờ kết quả',CLINICALLY_COMPLETED:'Hoàn tất chuyên môn',CLOSED:'Đã đóng',INTERRUPTED:'Gián đoạn',
 ORDERED:'Chờ tiếp nhận',ACCEPTED:'Đã tiếp nhận',PROCESSING:'Đang xử lý',RESULTED:'Chờ bác sĩ duyệt',REVIEWED:'Bác sĩ đã duyệt',VALIDATED:'Đã xác nhận chuyên môn',COMPLETION_PENDING:'Chờ hoàn tất',OPEN:'Đang mở',PAID:'Đã thu đủ',PARTIALLY_PAID:'Đã thu một phần',ISSUED:'Còn phải thu',LATE:'Đến muộn',NO_SHOW:'Không đến',DOCTOR_ABSENT:'Bác sĩ vắng',RESOLVED:'Đã xử lý',PENDING:'Đang chờ',DELIVERED:'Đã giao',RETRY:'Cần thử lại',DEAD:'Cần quản trị xử lý',
 CREATED:'Tạo hồ sơ',DRAFT_UPDATED:'Cập nhật hồ sơ',BRANCH_ADDED:'Thêm địa điểm',BRANCH_CREATED:'Thêm địa điểm',BRANCH_UPDATED:'Cập nhật địa điểm',REQUEST_CHANGES:'Yêu cầu bổ sung',NEEDS_CHANGES_REQUESTED:'Yêu cầu bổ sung',PUBLISH:'Công bố hồ sơ',UNPUBLISH:'Gỡ công bố',SUSPEND:'Tạm ngưng công bố'
};
export const stateName=(value:string)=>stateNames[value]??'Chưa xác định';
export function dateLabel(value?:string|null){
 if(!value)return 'Chưa ghi nhận';
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);return match?`${match[3]}/${match[2]}/${match[1]}`:value;
}
