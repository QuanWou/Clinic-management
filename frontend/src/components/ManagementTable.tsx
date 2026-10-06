import type {ReactNode} from 'react';
import {Search,Plus,ArrowLeft} from 'lucide-react';

export function ManagementToolbar({query,onQuery,count,label,onAdd,addLabel,disabled=false,children}:{query:string;onQuery:(value:string)=>void;count:number;label:string;onAdd?:()=>void;addLabel?:string;disabled?:boolean;children?:ReactNode}){
 return <div className="management-toolbar"><label className="management-search"><Search size={18} aria-hidden="true"/><input type="search" aria-label={label} placeholder={label} value={query} onChange={e=>onQuery(e.target.value)}/></label>{children}<span className="management-count">{count} kết quả</span>{onAdd&&<button type="button" className="booking-primary" disabled={disabled} onClick={onAdd}><Plus size={17} aria-hidden="true"/>{addLabel}</button>}</div>;
}
export function ManagementTable({caption,headers,children,empty=false}:{caption:string;headers:string[];children:ReactNode;empty?:boolean}){
 return <div className="management-table-scroll" tabIndex={0} role="region" aria-label={caption}><table className="management-table"><caption className="sr-only">{caption}</caption><thead><tr>{headers.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{empty?<tr><td colSpan={headers.length} className="management-empty">Không có dữ liệu phù hợp.</td></tr>:children}</tbody></table></div>;
}
export function ManagementDetail({title,onBack,disabled,children}:{title:string;onBack:()=>void;disabled:boolean;children:ReactNode}){
 return <section className="management-detail"><div className="management-detail-heading"><button type="button" disabled={disabled} onClick={onBack}><ArrowLeft size={17} aria-hidden="true"/>Về danh sách</button><h2>{title}</h2></div>{children}</section>;
}
export const matchesQuery=(query:string,...values:(string|null|undefined)[])=>values.join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().includes(query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().trim());
