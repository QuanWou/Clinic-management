import type {Scope} from '../api/reception';
import {receptionSubscription,type RealtimeState,type RealtimeSource} from '../api/realtime';
import {useAuthoritativeSync,type SyncContext} from './useAuthoritativeSync';
export function useReceptionRealtime(scope:Scope,refresh:(context:SyncContext)=>Promise<void>,blocked:boolean,sources:RealtimeSource[],onDenied:()=>void){
 return useAuthoritativeSync({key:[scope.token,scope.clinic,scope.branch].join(':'),enabled:!!scope.token&&!!scope.clinic&&!!scope.branch,refresh,blocked,subscriptions:sources.map(source=>receptionSubscription(scope,source)),onDenied});
}
export function RealtimeIndicator({state}:{state:RealtimeState}){return <span className="reception-realtime" data-state={state} role="status"><i aria-hidden="true"/>{state==='connected'?'Đang cập nhật trực tiếp':state==='reconnecting'?'Mất kết nối cập nhật trực tiếp. Đang kết nối lại…':'Chưa kết nối cập nhật trực tiếp'}</span>;}
