import { Search } from 'lucide-react';

export function WorklistTools({query, onQuery, state, onState, states, disabled, count, total, placeholder = 'Tìm tên hoặc mã lượt…'}: {
  query: string; onQuery: (value: string) => void;
  state: string; onState: (value: string) => void; states: Record<string, string>;
  disabled: boolean; count: number; total: number;
  placeholder?: string;
}) {
  return <div className="worklist-tools">
    <label className="worklist-search"><span className="sr-only">Tìm trong danh sách hiện có</span>
      <Search size={16} aria-hidden="true"/>
      <input type="search" placeholder={placeholder} value={query} disabled={disabled} onChange={e => onQuery(e.target.value)}/>
    </label>
    <label><span className="sr-only">Lọc trạng thái</span>
      <select value={state} disabled={disabled} onChange={e => onState(e.target.value)}>
        <option value="">Tất cả trạng thái</option>
        {Object.entries(states).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    <p className="worklist-count" aria-live="polite">Đang hiển thị {count}/{total} mục</p>
    {(query || state) && <button type="button" className="worklist-clear" disabled={disabled} onClick={() => {onQuery(''); onState('');}}>Xóa bộ lọc</button>}
  </div>;
}
