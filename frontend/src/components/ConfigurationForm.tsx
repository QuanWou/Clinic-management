import {DatePreview} from './DatePreview';
import {Fragment,useState} from 'react';
import {VndInput} from './VndInput';
import {useFormDraft} from './DraftBoundary';

export type Field={
 key:string;
 label:string;
 type?:'text'|'email'|'password'|'tel'|'date'|'time'|'datetime-local'|'number'|'checkbox'|'textarea'|'vnd';
 required?:boolean;
 min?:number;
 max?:number;
 maxLength?:number;
 pattern?:string;
 options?:{value:string;label:string}[];
 section?:string;
};
export type FormValues=Record<string,string|boolean>;

// Remount with a source version key to avoid silently overwriting a user's active draft.
export function ConfigurationForm({fields,initial,disabled,submit,label,validate,onCancel}:{fields:Field[];initial:FormValues;disabled:boolean;submit:(v:FormValues)=>Promise<void>;label:string;validate?:(v:FormValues)=>string|null;onCancel?:()=>void}){
 const [values,setValues]=useState(initial);
 const [error,setError]=useState('');
 const dirty=fields.some(f=>(values[f.key]??'')!==(initial[f.key]??''));
 const otherDraft=useFormDraft(dirty,label,()=>setValues(initial));
 return <form className="configuration-form" onSubmit={e=>{e.preventDefault();const message=validate?.(values);setError(message??'');if(!message)void submit(values);}}>
  {error&&<p role="alert" className="booking-error">{error}</p>}
  <fieldset className="configuration-fields" disabled={disabled||otherDraft}>
   {fields.map((f,index)=><Fragment key={f.key}>
    {f.section&&f.section!==fields[index-1]?.section&&<div className="configuration-field-section"><span>{f.section}</span></div>}
    <label className={f.type==='textarea'?'configuration-wide':f.type==='checkbox'?'configuration-check':undefined}>
     <span className="configuration-label">{f.label}{f.required&&<span aria-hidden="true" className="configuration-required"> *</span>}</span>
     {f.options?<select aria-label={f.label} required={f.required} value={String(values[f.key]??'')} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}>{f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
     :f.type==='vnd'?<VndInput label={f.label} value={String(values[f.key]??'')} onChange={value=>setValues(v=>({...v,[f.key]:value}))} allowZero required={f.required}/>
     :f.type==='textarea'?<textarea aria-label={f.label} maxLength={f.maxLength} required={f.required} value={String(values[f.key]??'')} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}/>
     :f.type==='checkbox'?<input aria-label={f.label} type="checkbox" checked={values[f.key]===true} onChange={e=>setValues(v=>({...v,[f.key]:e.target.checked}))}/>
     :<input aria-label={f.label} type={f.type??'text'} autoComplete={f.type==='password'?'new-password':undefined} required={f.required} min={f.min} max={f.max} maxLength={f.maxLength} pattern={f.pattern} value={String(values[f.key]??'')} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}/>}
     {f.type==='date'&&<DatePreview value={String(values[f.key]??'')}/>}
    </label>
   </Fragment>)}
   <div className="configuration-form-actions"><button className="booking-primary">{label}</button>{onCancel&&<button type="button" className="button-secondary" onClick={onCancel}>Hủy</button>}</div>
  </fieldset>
 </form>;
}
