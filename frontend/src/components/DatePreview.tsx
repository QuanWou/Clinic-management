import {dateLabel} from '../utils/display';
export function DatePreview({value}:{value:string}){return value?<small className="date-preview" aria-hidden="true">Ngày đã chọn: {dateLabel(value)}</small>:null;}
