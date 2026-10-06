import { useEffect,useRef,useState } from 'react';
import { notificationState,type NotificationState } from '../api/billing';
import type { Scope } from '../api/reception';
export function CashierNotificationPanel({scope,billId,version,onRetry,canRetry}:{scope:Scope;billId:string;version:number;onRetry?:()=>void;canRetry:boolean}){
 const [state,setState]=useState<NotificationState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);const epoch=useRef(0);
 useEffect(()=>{epoch.current++;setState(null);setError('');setBusy(false);return ()=>{epoch.current++;};},[scope.token,scope.clinic,scope.branch,billId,version]);
 async function read(){const current=++epoch.current;setState(null);setError('');setBusy(true);try{const source=await notificationState(scope,billId);if(current===epoch.current)setState(source);}catch(e){if(current===epoch.current)setError(e instanceof Error?e.message:'Chưa đồng bộ được trạng thái thông báo.');}finally{if(current===epoch.current)setBusy(false);}}
 useEffect(()=>{if(billId)void read();},[scope.token,scope.clinic,scope.branch,billId,version]);
 return <article className="booking-appointment"><h2>Thông báo phiếu thu</h2>{busy&&<p role="status">Đang kiểm tra nguồn giao thông báo…</p>}{error&&<p role="alert">{error}</p>}
 {state&&<><p>Đã ghi vào thông báo trong ứng dụng: {state.delivered}</p>{state.pending>0&&<p>Còn {state.pending} thông báo đang chờ giao.</p>}{state.manualContact>0&&<p>Có {state.manualContact} thông báo cần liên hệ trực tiếp. Kiểm tra tài khoản và liên kết hồ sơ của bệnh nhân.</p>}{state.failed>0&&<p role="alert">Có {state.failed} thông báo chưa giao được sau các lần thử. Quản lý cần kiểm tra kết nối và xử lý giao lại.</p>}{onRetry&&(state.failed>0||state.manualContact>0)&&<button type="button" disabled={!canRetry||busy} onClick={onRetry}>Yêu cầu giao lại thông báo</button>}</>}
 <p>Trạng thái giao thông báo tách riêng với việc ghi nhận tiền tại quầy.</p></article>;
}
