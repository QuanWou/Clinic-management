import {useDraftGuard} from './DraftBoundary';
import {useState} from 'react';
import {Pencil,Tags} from 'lucide-react';
import {ManagementTable,ManagementToolbar,ManagementDetail,matchesQuery} from './ManagementTable';
import {parseVnd} from '../utils/vnd';
import * as api from '../api/configuration';
import {ConfigurationForm,type Field} from './ConfigurationForm';
import {useConfigurationSource,type ConfigurationProps} from './ConfigurationPanel';
import {specialtyDisplay,specialtyOptions} from '../utils/specialty';

const fields:Field[]=[
 {key:'name',label:'Tên dịch vụ',required:true,maxLength:220},
 {key:'description',label:'Mô tả dịch vụ',type:'textarea',maxLength:1000},
 {key:'specialtyCode',label:'Chuyên khoa của dịch vụ',options:[{value:'',label:'Chưa gán chuyên khoa'},...specialtyOptions]},
 {key:'active',label:'Dịch vụ đang hoạt động',type:'checkbox'}
];
const assignmentFields:Field[]=[
 {key:'durationMinutes',label:'Thời lượng (phút)',type:'number',min:5,max:720,required:true},
 {key:'active',label:'Cung cấp tại địa điểm này',type:'checkbox'},
 {key:'publicVisible',label:'Hiển thị dịch vụ công khai',type:'checkbox'}
];
const money=(amount:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(amount);
const currentPrice=(prices:api.Price[])=>[...prices].filter(p=>new Date(p.effectiveFrom).getTime()<=Date.now()).sort((a,b)=>new Date(b.effectiveFrom).getTime()-new Date(a.effectiveFrom).getTime())[0];

export function CatalogConfiguration(props:ConfigurationProps&{section?:'services'|'prices'}){
 const drafts=useDraftGuard();
 const {session,disabled,revision,act}=props;
 const section=props.section??'services';
 const [selected,setSelected]=useState('');
 const [query,setQuery]=useState('');
 const [statusFilter,setStatusFilter]=useState('active');
 const [creating,setCreating]=useState(false);
 const [tab,setTab]=useState<'profile'|'price'>(section==='prices'?'price':'profile');
 const {data,error}=useConfigurationSource(async()=>{
  const [offerings,assignments]=await Promise.all([api.offerings(session),api.assignments(session)]);
  const entries=await Promise.all(assignments.map(async a=>[a.offering.id,await api.prices(session,a.offering.id)] as const));
  return {offerings,assignments,prices:Object.fromEntries(entries)};
 },[session.token,session.clinic,session.branch,revision]);

 if(error)return <p role="alert">{error}</p>;
 if(!data)return <p role="status">Đang tải dịch vụ và bảng giá…</p>;

 const locked=disabled||!!drafts?.active;
 const current=data.offerings.find(o=>o.id===selected);
 const assigned=data.assignments.find(a=>a.offering.id===selected);
 const rows=data.offerings.filter(o=>(statusFilter==='all'||o.active===(statusFilter==='active'))&&matchesQuery(query,o.code,o.name,o.specialtyCode,specialtyDisplay(o.specialtyCode)));

 if(creating)return <ManagementDetail title="Thêm dịch vụ" onBack={()=>setCreating(false)} disabled={locked}>
  <ConfigurationForm fields={[{key:'code',label:'Mã dịch vụ',required:true,pattern:'[A-Z0-9._-]{1,60}'},...fields]} initial={{code:'',name:'',description:'',specialtyCode:'',active:true}} disabled={disabled} label="Thêm dịch vụ" onCancel={()=>setCreating(false)} submit={v=>act(async()=>{
   const added=await api.saveOffering(session,{code:v.code,name:v.name,description:v.description,specialtyCode:String(v.specialtyCode??'')||null,active:v.active===true});
   setCreating(false);setSelected(added.id);setTab('profile');
  })}/>
 </ManagementDetail>;

 if(current)return <ManagementDetail title={current.name} onBack={()=>setSelected('')} disabled={locked}>
  <p className="muted-copy">{current.code} · {current.active?'Đang hoạt động':'Ngừng hoạt động'}{current.specialtyCode?' · '+specialtyDisplay(current.specialtyCode):''}</p>
  <div className="management-tabs" role="group" aria-label="Quản lý dịch vụ">
   <button type="button" aria-pressed={tab==='profile'} disabled={locked} onClick={()=>setTab('profile')}>Thông tin dịch vụ</button>
   <button type="button" aria-pressed={tab==='price'} disabled={locked} onClick={()=>setTab('price')}>Bảng giá</button>
  </div>
  {tab==='profile'?<>
   <ConfigurationForm key={`offering-${current.id}-${current.version}`} fields={fields} initial={{name:current.name,description:current.description??'',specialtyCode:current.specialtyCode??'',active:current.active}} disabled={disabled} label="Lưu dịch vụ" submit={v=>act(()=>api.saveOffering(session,{expectedVersion:current.version,name:v.name,description:v.description,specialtyCode:String(v.specialtyCode??'')||null,active:v.active===true},current.id))}/>
   <h3>Khả dụng và hiển thị Public</h3>
   <p className="muted-copy">Trạng thái dịch vụ, cung cấp tại chi nhánh và hiển thị Public là các khái niệm riêng. Hệ thống hiện chưa có cờ Booking Enabled độc lập cho service.</p>
   <ConfigurationForm key={`assignment-${assigned?.id??current.id}-${assigned?.version??revision}`} fields={assignmentFields} initial={{durationMinutes:String(assigned?.durationMinutes??30),active:assigned?.active??true,publicVisible:assigned?.publicVisible??false}} disabled={disabled} label={assigned?'Lưu thời lượng và hiển thị':'Thiết lập cung cấp dịch vụ'} submit={v=>act(()=>api.saveAssignment(session,{...(assigned?{expectedVersion:assigned.version}:{offeringId:current.id}),durationMinutes:Number(v.durationMinutes),active:v.active===true,publicVisible:v.publicVisible===true},assigned?.id))}/>
  </>:assigned?<PriceConfiguration key={current.id} offering={current} {...props}/>:<div className="task-empty"><p>Thiết lập cung cấp dịch vụ trước khi cập nhật giá.</p><button type="button" onClick={()=>setTab('profile')}>Thiết lập dịch vụ</button></div>}
 </ManagementDetail>;

 return <section className="management-section">
  <p className="management-intro">{section==='prices'
   ?'Theo dõi giá đang có hiệu lực và lịch sử phiên bản. Cập nhật giá tạo phiên bản mới; hóa đơn lịch sử không bị sửa.'
   :'Quản lý chuyên khoa liên kết, dịch vụ, thời lượng, trạng thái cung cấp và hiển thị Public.'}</p>
  <ManagementToolbar label="Tìm mã hoặc tên dịch vụ" query={query} onQuery={setQuery} count={rows.length} onAdd={section==='services'?()=>setCreating(true):undefined} addLabel="Thêm dịch vụ" disabled={locked}>
   <select className="management-filter" aria-label="Trạng thái dịch vụ" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="active">Đang hoạt động</option><option value="inactive">Ngừng hoạt động</option><option value="all">Tất cả trạng thái</option></select>
  </ManagementToolbar>
  {section==='prices'
   ?<ManagementTable caption="Bảng giá dịch vụ" headers={['Dịch vụ','Giá hiện tại','Hiệu lực từ','Trạng thái','Thao tác']} empty={!rows.length}>{rows.map(o=>{const price=currentPrice(data.prices[o.id]??[]);return <tr key={o.id}><td><strong>{o.name}</strong><small>{o.code}</small></td><td className="management-money"><strong>{price?money(price.amountVnd):'Chưa có giá'}</strong></td><td>{price?new Date(price.effectiveFrom).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—'}</td><td><span className="task-status" data-state={price?'ACTIVE':'WAITING'}>{price?'Đang có hiệu lực':'Thiếu giá'}</span></td><td><div className="management-actions"><button type="button" aria-label={'Cập nhật giá '+o.name} disabled={locked} onClick={()=>{setSelected(o.id);setTab('price');}}><Tags size={15} aria-hidden="true"/>Cập nhật giá</button></div></td></tr>;})}</ManagementTable>
   :<ManagementTable caption="Chuyên khoa và dịch vụ" headers={['Dịch vụ','Chuyên khoa','Thời lượng','Public','Trạng thái','Thao tác']} empty={!rows.length}>{rows.map(o=>{const a=data.assignments.find(a=>a.offering.id===o.id);return <tr key={o.id}><td><strong>{o.name}</strong><small>{o.code}</small></td><td><strong>{specialtyDisplay(o.specialtyCode)}</strong>{o.specialtyCode&&<small>Mã: {o.specialtyCode}</small>}</td><td>{a?a.durationMinutes+' phút':'Chưa thiết lập'}</td><td><span className="task-status" data-state={a?.publicVisible?'ACTIVE':'INACTIVE'}>{a?.publicVisible?'Có':'Không'}</span></td><td><span className="task-status" data-state={o.active&&a?.active?'ACTIVE':'INACTIVE'}>{!o.active?'Ngừng hoạt động':a?.active?'Đang cung cấp':'Chưa cung cấp'}</span></td><td><div className="management-actions"><button type="button" aria-label={'Quản lý '+o.name} disabled={locked} onClick={()=>{setSelected(o.id);setTab('profile');}}><Pencil size={15} aria-hidden="true"/>Quản lý</button><button type="button" aria-label={'Bảng giá '+o.name} disabled={locked} onClick={()=>{setSelected(o.id);setTab('price');}}><Tags size={15} aria-hidden="true"/>Bảng giá</button></div></td></tr>;})}</ManagementTable>}
 </section>;
}

function PriceConfiguration({offering,session,disabled,revision,act}:ConfigurationProps&{offering:api.Offering}){
 const drafts=useDraftGuard(),[creating,setCreating]=useState(false);
 const {data,error}=useConfigurationSource(()=>api.prices(session,offering.id),[session.token,session.clinic,session.branch,offering.id,revision]);
 if(error)return <p role="alert">{error}</p>;
 if(!data)return <p role="status">Đang tải bảng giá…</p>;
 const current=currentPrice(data);
 return <section>
  <div className="management-subheading"><div><h3>Giá và lịch sử áp dụng</h3><p className="muted-copy">Giá đã chốt của lịch khám và dịch vụ đã thực hiện được giữ nguyên.</p>{current&&<p className="price-current">Hiện tại: <strong>{money(current.amountVnd)}</strong> · từ {new Date(current.effectiveFrom).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</p>}</div><button type="button" className="booking-primary" disabled={disabled||!!drafts?.active} onClick={()=>setCreating(true)}>Cập nhật giá</button></div>
  {creating&&<section className="management-editor"><h3>Cập nhật giá</h3><ConfigurationForm key={`price-create-${revision}`} fields={[{key:'amountVnd',label:'Giá mới (VND)',type:'vnd',min:0,max:9000000000000,required:true},{key:'effectiveFrom',label:'Có hiệu lực từ (giờ Việt Nam)',type:'datetime-local',required:true}]} initial={{amountVnd:'',effectiveFrom:''}} disabled={disabled} label="Tạo phiên bản giá" onCancel={()=>setCreating(false)} submit={v=>act(async()=>{await api.addPrice(session,{offeringId:offering.id,amountVnd:parseVnd(String(v.amountVnd),true),effectiveFrom:new Date(String(v.effectiveFrom)+'+07:00').toISOString()});setCreating(false);})}/></section>}
  <ManagementTable caption={'Bảng giá '+offering.name} headers={['Mức giá','Áp dụng từ (giờ Việt Nam)','Trạng thái']} empty={!data.length}>{[...data].sort((a,b)=>new Date(b.effectiveFrom).getTime()-new Date(a.effectiveFrom).getTime()).map(p=><tr key={p.id}><td className="management-money"><strong>{money(p.amountVnd)}</strong></td><td>{new Date(p.effectiveFrom).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</td><td><span className="task-status" data-state={current?.id===p.id?'ACTIVE':undefined}>{current?.id===p.id?'Đang áp dụng':new Date(p.effectiveFrom).getTime()>Date.now()?'Sắp áp dụng':'Giá trước đây'}</span></td></tr>)}</ManagementTable>
 </section>;
}
