import {useEffect,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
export function ConfirmDialog({title,children,confirmLabel,onConfirm,onCancel,busy=false}:{title:string;children:ReactNode;confirmLabel:string;onConfirm:()=>void;onCancel:()=>void;busy?:boolean}){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;return()=>{previous?.focus();};},[]);
 useEffect(()=>{if(!busy&&!root.current?.contains(document.activeElement))root.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();},[busy]);
 return createPortal(<div className="confirm-backdrop"><div ref={root} role="dialog" aria-modal="true" aria-labelledby="confirmation-title" className="confirm-dialog" onKeyDown={e=>{
  if(e.key==='Escape'&&!busy){e.preventDefault();onCancel();}
  if(e.key==='Tab'){const focusable=Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]')??[]);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
 }}><h2 id="confirmation-title">{title}</h2>{children}<div className="task-button-row"><button type="button" disabled={busy} onClick={onCancel}>Quay lại kiểm tra</button><button type="button" className="booking-primary" disabled={busy} onClick={onConfirm}>{confirmLabel}</button></div></div></div>,document.body);
}
