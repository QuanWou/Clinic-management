import {useEffect,useRef,useState} from 'react';
import {Bell} from 'lucide-react';
import {getNotifications,getUnreadNotificationCount,markNotificationRead,type Notification} from '../api/booking';
import {notificationSubscription} from '../api/realtime';
import {useAuthoritativeSync} from './useAuthoritativeSync';

/** List replacement and persisted read state make reconnect and duplicate delivery idempotent. */
export function NotificationInbox({token}:{token:string}){
 const [rows,setRows]=useState<Notification[]>([]),[open,setOpen]=useState(false),[error,setError]=useState(''),[reading,setReading]=useState(false);
 const [unread,setUnread]=useState(0),epoch=useRef(0);
 useEffect(()=>{epoch.current++;setRows([]);setUnread(0);setReading(false);setOpen(false);setError('');return()=>{epoch.current++;};},[token]);
 useAuthoritativeSync({key:token,enabled:!!token,initial:true,blocked:reading,subscriptions:[notificationSubscription(token)],refresh:async context=>{
  try{const [rows,count]=await Promise.all([getNotifications(token),getUnreadNotificationCount(token)]);if(!Array.isArray(rows)||!Number.isFinite(count.count))throw new Error('Invalid inbox response');if(context.current()){setRows(rows);setUnread(count.count);setError('');}}catch(e){if(context.current())setError('Chưa cập nhật được thông báo. Hệ thống sẽ thử lại.');throw e;}
 },onDenied:()=>{epoch.current++;setRows([]);setUnread(0);setOpen(false);}});
 async function read(id:string){const current=epoch.current;setReading(true);try{await markNotificationRead(token,id);const [rows,count]=await Promise.all([getNotifications(token),getUnreadNotificationCount(token)]);if(current===epoch.current){setRows(rows);setUnread(count.count);setError('');}}catch{if(current===epoch.current)setError('Chưa ghi nhận được trạng thái đã đọc.');}finally{if(current===epoch.current)setReading(false);}}
 return <div className="notification-inbox"><button type="button" aria-label={'Thông báo, '+unread+' chưa đọc'} aria-expanded={open} onClick={()=>setOpen(value=>!value)}><Bell size={18} aria-hidden="true"/>{unread>0&&<span className="notification-count">{unread}</span>}</button>
  {open&&<section className="notification-popover" aria-label="Thông báo tài khoản"><h2>Thông báo</h2>{error&&<p role="alert">{error}</p>}{!rows.length&&!error&&<p>Chưa có thông báo.</p>}<ul>{rows.map(row=><li key={row.id}><p>{row.message}</p><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString('vi-VN')}</time>{!row.read_at&&<button disabled={reading} onClick={()=>void read(row.id)}>Đánh dấu đã đọc</button>}</li>)}</ul></section>}
 </div>;
}
