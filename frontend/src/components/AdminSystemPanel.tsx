import {useAuthoritativeSync} from './useAuthoritativeSync';

import {useEffect,useMemo,useRef,useState} from 'react';
import {KeyRound,RefreshCw,ShieldCheck} from 'lucide-react';
import {useSession} from '../auth/SessionProvider';
import * as api from '../api/configuration';
import * as auditApi from '../api/audit';

type Mode='permissions'|'audit';
type TimelineRow={
 id:string;
 occurredAt:string;
 category:string;
 action:string;
 resourceType:string;
 resourceId:string;
 actorUserId:string;
 outcome:string;
 source:'IAM'|'AUDIT';
};

const actionLabel:Record<string,string>={
 STAFF_ADDED:'Thêm nhân sự',
 STAFF_ROLE_CHANGED:'Thay đổi vai trò',
 REVOKED:'Thu hồi quyền',
 BRANCH_GRANTED:'Cấp quyền chi nhánh',
 BRANCH_REVOKED:'Thu hồi quyền chi nhánh',
 INVITED:'Mời nhân sự',
 ACTIVATED:'Kích hoạt quyền',
 OWNER_BOOTSTRAPPED:'Khởi tạo quyền chủ cơ sở',
 ACADEMIC_ROLE_MIGRATED:'Chuẩn hóa vai trò',
 'clinic.appointment.confirmed.v1':'Xác nhận lịch hẹn',
 'clinic.appointment.cancelled.v1':'Hủy lịch hẹn',
 'clinic.appointment.rescheduled.v1':'Đổi lịch hẹn',
 'clinic.appointment.exception_recorded.v1':'Ghi nhận ngoại lệ lịch hẹn',
 'clinic.appointment.exception_resolved.v1':'Xử lý ngoại lệ lịch hẹn',
 'clinic.encounter.checked_in.v1':'Tiếp nhận lượt khám',
 'clinic.encounter.arrival_recovered.v1':'Khôi phục lượt tiếp nhận',
 'clinic.encounter.queue_changed.v1':'Thay đổi hàng đợi',
 'clinic.encounter.started.v1':'Bắt đầu lượt khám',
 'clinic.encounter.awaiting_results.v1':'Chuyển sang chờ kết quả',
 'clinic.encounter.return_queued.v1':'Đưa lượt khám trở lại hàng đợi',
 'clinic.encounter.clinically_completed.v1':'Hoàn tất chuyên môn',
 'clinic.encounter.closed.v1':'Đóng lượt khám',
 'clinic.encounter.billing_retry_requested.v1':'Yêu cầu gửi lại dữ liệu tính phí',
 'clinic.billing.bill_issued.v1':'Phát hành phiếu thu',
 'clinic.billing.onsite_collected.v1':'Ghi nhận thanh toán tại quầy',
 'clinic.billing.online_collected.v1':'Ghi nhận thanh toán trực tuyến',
 'clinic.billing.adjustment_approved.v1':'Duyệt điều chỉnh tài chính',
 'clinic.billing.shift_submitted.v1':'Gửi ca thu để đối soát',
 'clinic.billing.shift_approved.v1':'Duyệt ca thu',
 'clinic.billing.notification_retry_requested.v1':'Yêu cầu gửi lại thông báo tài chính',
 'clinic.billing.charge_retry_requested.v1':'Yêu cầu đồng bộ lại khoản phí'
};
const categoryLabel:Record<string,string>={
 MEMBERSHIP:'Quyền & nhân sự',AUTH:'Xác thực',CLINIC_ADMIN:'Quản trị',CLINICAL:'Lâm sàng',
 BILLING:'Tài chính',SECURITY:'Bảo mật',SYSTEM:'Vận hành'
};
const outcomeLabel:Record<string,string>={SUCCESS:'Thành công',DENIED:'Bị từ chối',FAILED:'Thất bại',PENDING:'Đang chờ'};
const resourceLabel:Record<string,string>={
 membership:'Nhân sự',appointment:'Lịch hẹn',encounter:'Lượt khám',billing:'Tài chính',
 medical:'Hồ sơ y khoa',patient:'Bệnh nhân',clinic:'Phòng khám'
};
const roleInfo=[
 {role:'ADMIN',label:'Quản trị phòng khám',summary:'Cấu hình phòng khám, nhân sự, bác sĩ, danh mục, lịch làm việc và giám sát.',allowed:'Giám sát vận hành · Giám sát tài chính · Quản lý cấu hình · Xem nhật ký',denied:'Không mặc định tiếp nhận · Không thu tiền · Không đọc hồ sơ lâm sàng'},
 {role:'STAFF',label:'Lễ tân / Thu ngân',summary:'Thực hiện công việc quầy theo phạm vi chi nhánh được cấp.',allowed:'Tiếp nhận · Hàng đợi · Thu phí',denied:'Không quản lý nhân sự · Không duyệt tài chính · Không xem nhật ký quản trị'},
 {role:'DOCTOR',label:'Bác sĩ',summary:'Làm việc chuyên môn theo liên kết bác sĩ và lịch được cấu hình.',allowed:'Khám · Nghiệp vụ chuyên môn được cấp',denied:'Không thu phí · Không quản lý nhân sự · Không xem nhật ký quản trị'}
];

const shortId=(value:string)=>value.length>12?value.slice(0,8)+'…':value;

export function AdminSystemPanel({mode,clinicId}:{mode:Mode;clinicId:string}){
 const auth=useSession()!;
 const session=auth.workspaceSession;
 const [staff,setStaff]=useState<api.StaffRow[]|null>(null);
 const [membershipEvents,setMembershipEvents]=useState<api.MembershipEvent[]>([]);
 const [auditEvents,setAuditEvents]=useState<auditApi.AdminAuditEvent[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[warning,setWarning]=useState(''),[lastUpdated,setLastUpdated]=useState<Date|null>(null);
 const epoch=useRef(0);
 const scope=useMemo(()=>session?{token:session.token,clinic:clinicId}:null,[session?.token,clinicId]);

 async function load(){
  if(!scope)return;
  const current=++epoch.current;setBusy(true);setError('');setWarning('');
  if(mode==='permissions'){
   try{const rows=await api.staff(scope);if(current===epoch.current){setStaff(rows);setLastUpdated(new Date());}}
   catch(e){if(current===epoch.current)setError(e instanceof Error?e.message:'Không thể tải dữ liệu phân quyền phòng khám.');}
   finally{if(current===epoch.current){setLastUpdated(new Date());setBusy(false);}}
   return;
  }
  const [staffResult,membershipResult,auditResult]=await Promise.allSettled([
   api.staff(scope),api.membershipEvents(scope),auditApi.events(scope.token,scope.clinic,200)
  ]);
  if(current!==epoch.current)return;
  setStaff(staffResult.status==='fulfilled'?staffResult.value:[]);
  setMembershipEvents(membershipResult.status==='fulfilled'?membershipResult.value:[]);
  setAuditEvents(auditResult.status==='fulfilled'?auditResult.value:[]);
  const failed=[
   staffResult.status==='rejected'?'danh bạ nhân sự':'',
   membershipResult.status==='rejected'?'nhật ký IAM':'',
   auditResult.status==='rejected'?'Audit service':''
  ].filter(Boolean);
  if(failed.length===3)setError('Không thể tải các nguồn nhật ký quản trị. Vui lòng thử lại.');
  else if(failed.length)setWarning('Một phần nhật ký chưa tải được: '+failed.join(', ')+'. Dữ liệu còn lại vẫn được giữ nguyên.');
  setLastUpdated(new Date());setBusy(false);
 }
 useEffect(()=>{void load();return()=>{epoch.current++;};},[scope?.token,scope?.clinic,mode]);

 useAuthoritativeSync({key:(scope?.token??'')+clinicId+mode,enabled:!!scope&&mode==='permissions',blocked:busy,refresh:async context=>{const current=epoch.current;const rows=await api.staff(scope!);if(context.current()&&current===epoch.current){setStaff(rows);setLastUpdated(new Date());}}});
 const names=new Map((staff??[]).map(row=>[row.membership.userId,row.account?.fullName??row.account?.email??row.membership.userId]));
 const timeline=useMemo<TimelineRow[]>(()=>{
  const iamRows=membershipEvents.map(event=>({
   id:'iam:'+event.id,occurredAt:event.occurredAt,category:'MEMBERSHIP',action:event.action,
   resourceType:'membership',resourceId:event.targetUserId,actorUserId:event.actorUserId,
   outcome:'SUCCESS',source:'IAM' as const
  }));
  const centralRows=auditEvents.map(event=>({
   id:'audit:'+event.id,occurredAt:event.occurredAt,category:event.category,action:event.action,
   resourceType:event.resourceType,resourceId:event.resourceId,actorUserId:event.actorUserId,
   outcome:event.outcome,source:'AUDIT' as const
  }));
  return [...iamRows,...centralRows].sort((a,b)=>new Date(b.occurredAt).getTime()-new Date(a.occurredAt).getTime()).slice(0,200);
 },[membershipEvents,auditEvents]);

 if(mode==='permissions')return <section className="booking-panel admin-system-panel">
  <header className="task-panel-header admin-page-header"><div><span className="eyebrow">HỆ THỐNG</span><h1>Phân quyền</h1><p>Phân quyền hiện tại theo role/capability của phòng khám. Quản trị không mặc định kế thừa quyền Lễ tân, Thu ngân hoặc Bác sĩ.</p></div><div className="admin-page-utilities"><span>Cập nhật lúc {lastUpdated?lastUpdated.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}):'—'}</span><button type="button" className="admin-icon-button" aria-label="Cập nhật phân quyền" title="Cập nhật phân quyền" disabled={busy} onClick={()=>void load()}><RefreshCw size={17}/></button></div></header>
  {busy&&<p role="status">Đang tải phân quyền…</p>}{error&&<p role="alert" className="booking-error">{error}</p>}
  <div className="permission-role-grid">{roleInfo.map(item=><article className="task-card permission-role" key={item.role}><span className="task-status">{item.role}</span><h2>{item.label}</h2><p>{item.summary}</p><dl><div><dt>Được cấp theo role</dt><dd>{item.allowed}</dd></div><div><dt>Không tự động có</dt><dd>{item.denied}</dd></div></dl></article>)}</div>
  <section className="admin-table-section"><div className="admin-section-heading"><div><h2>Phân công hiện tại</h2><p>Thay đổi role và trạng thái nhân sự được thực hiện tại màn Nhân sự và được ghi nhật ký.</p></div></div>
   {!staff?.length&&!busy?<div className="task-empty"><p>Chưa có nhân sự trong phòng khám.</p></div>:<div className="admin-table"><div className="admin-table-row admin-table-head"><span>Nhân sự</span><span>Vai trò</span><span>Trạng thái</span><span>Phạm vi</span></div>{staff?.map(row=><div className="admin-table-row" key={row.membership.id}><span><strong>{row.account?.fullName??'Chưa có hồ sơ tài khoản'}</strong><small>{row.account?.email??row.membership.userId}</small></span><span>{roleInfo.find(x=>x.role===row.membership.role)?.label??row.membership.role}</span><span><span className="task-status" data-state={row.membership.status}>{row.membership.status}</span></span><span>{row.membership.allBranches?'Toàn phòng khám':row.membership.branchIds.length+' chi nhánh'}</span></div>)}</div>}
  </section>
 </section>;

 return <section className="booking-panel admin-system-panel">
  <header className="task-panel-header admin-page-header"><div><span className="eyebrow">HỆ THỐNG</span><h1>Nhật ký hoạt động</h1><p>Timeline hợp nhất thay đổi quyền/nhân sự và các sự kiện vận hành đã chuẩn hóa. Không hiển thị secret, token, payload lâm sàng, lý do nhạy cảm hoặc hash chain.</p></div><div className="admin-page-utilities"><span>Cập nhật lúc {lastUpdated?lastUpdated.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}):'—'}</span><button type="button" className="admin-icon-button" aria-label="Cập nhật nhật ký" title="Cập nhật nhật ký" disabled={busy} onClick={()=>void load()}><RefreshCw size={17}/></button></div></header>
  {busy&&<p role="status">Đang tải nhật ký…</p>}{error&&<p role="alert" className="booking-error">{error}</p>}{warning&&<div className="admin-data-warning" role="status"><div><strong>Dữ liệu chưa đầy đủ</strong><p>{warning}</p></div></div>}
  <div className="admin-audit-summary"><ShieldCheck size={18}/><span><strong>{timeline.length}</strong> sự kiện gần nhất</span><small>{membershipEvents.length} IAM · {auditEvents.length} Audit service · tối đa 200 dòng hiển thị</small></div>
  {!timeline.length&&!busy?<div className="task-empty"><p>Chưa có sự kiện quản trị hoặc vận hành nào được ghi nhận.</p></div>:<div className="admin-table audit-table"><div className="admin-table-row admin-table-head"><span>Thời gian</span><span>Nhóm</span><span>Hành động</span><span>Đối tượng</span><span>Người thực hiện</span><span>Kết quả</span></div>{timeline.map(event=><div className="admin-table-row" key={event.id}><span>{new Date(event.occurredAt).toLocaleString('vi-VN')}</span><span><strong>{categoryLabel[event.category]??event.category}</strong><small>{event.source}</small></span><span><strong>{actionLabel[event.action]??event.action}</strong></span><span>{event.resourceType==='membership'?(names.get(event.resourceId)??shortId(event.resourceId)):<><strong>{resourceLabel[event.resourceType]??event.resourceType}</strong><small>{shortId(event.resourceId)}</small></>}</span><span>{names.get(event.actorUserId)??shortId(event.actorUserId)}</span><span><span className="task-status" data-state={event.outcome}>{outcomeLabel[event.outcome]??event.outcome}</span></span></div>)}</div>}
  <div className="admin-audit-scope"><KeyRound size={16}/><p>Audit service chỉ trả projection quản trị đã làm sạch: thời gian, actor, nhóm/hành động, loại tài nguyên, định danh kỹ thuật và kết quả. Metadata nguồn, nội dung hồ sơ, lý do nhạy cảm và hash kiểm chứng vẫn nằm trong backend.</p></div>
 </section>;
}
