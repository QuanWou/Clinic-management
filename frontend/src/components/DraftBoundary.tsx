import {createContext,useCallback,useContext,useEffect,useId,useRef,useState,type ReactNode} from 'react';

type Draft={id:string;label:string;discard:()=>void};
type Guard={active:Draft|null;register:(draft:Draft,dirty:boolean)=>void;remove:(id:string)=>void};
const Context=createContext<Guard|null>(null);

/** Drafts stay in memory and belong to the mounted actor/scope. One form is
 * edited at a time so saving it cannot remount and erase another form's edits. */
export function DraftBoundary({children}:{children:ReactNode}){
 const [active,setActive]=useState<Draft|null>(null);
 const register=useCallback((draft:Draft,dirty:boolean)=>setActive(current=>dirty?(current??draft):(current?.id===draft.id?null:current)),[]);
 const remove=useCallback((id:string)=>setActive(current=>current?.id===id?null:current),[]);
 return <Context.Provider value={{active,register,remove}}>{children}</Context.Provider>;
}
export function useDraftGuard(){return useContext(Context);}
export function useFormDraft(dirty:boolean,label:string,discard:()=>void){
 const guard=useDraftGuard(),id=useId(),latest=useRef(discard);latest.current=discard;
 const register=guard?.register,remove=guard?.remove;
 useEffect(()=>{register?.({id,label,discard:()=>latest.current()},dirty);},[register,id,label,dirty]);
 useEffect(()=>()=>remove?.(id),[remove,id]);
 return !!guard?.active&&guard.active.id!==id;
}
export function DraftNotice({disabled=false}:{disabled?:boolean}){
 const guard=useDraftGuard();if(!guard?.active)return null;
 return <div role="status" className="navigation-lock"><p>Đang sửa: {guard.active.label}. Lưu hoặc bỏ thay đổi trước khi chuyển màn.</p><button type="button" disabled={disabled} onClick={()=>guard.active?.discard()}>Bỏ thay đổi chưa lưu</button></div>;
}
