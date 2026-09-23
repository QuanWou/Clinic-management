import { type KeyboardEvent, type Ref, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, Stethoscope } from 'lucide-react';
import type { DoctorProfileResponse } from '../types/domain';
import { doctorName } from '../utils/doctorNames';
import './doctorPicker.css';

const specialtyTranslations: Record<string, string> = {
  cardiology: 'Tim mạch',
  'general medicine': 'Nội tổng quát',
  neurology: 'Thần kinh',
  pediatrics: 'Nhi khoa',
  oncology: 'Ung bướu',
  orthopedics: 'Chấn thương chỉnh hình'
};

export function doctorSpecialty(doctor: DoctorProfileResponse): string {
  const name = doctor.specialtyName?.trim();
  return name ? specialtyTranslations[name.toLocaleLowerCase('en-US')] ?? name : 'Chưa cập nhật chuyên khoa';
}

/** Search only fields verified for each doctor; keep the complete doctor ID as the form value. */
export function filterBookingDoctors(doctors: DoctorProfileResponse[], query: string): DoctorProfileResponse[] {
  const term = query.trim().toLocaleLowerCase('vi-VN');
  return doctors.filter((doctor) => !term || [doctor.fullName ?? '', doctorSpecialty(doctor), doctor.specialtyName ?? '']
    .some((field) => field.toLocaleLowerCase('vi-VN').includes(term)));
}

type Props = {
  doctors: DoctorProfileResponse[];
  value: string;
  onChange: (doctorId: string) => void;
  labelId: string;
  disabled?: boolean;
  loading?: boolean;
  invalid?: boolean;
  triggerRef?: Ref<HTMLButtonElement>;
};

/** Compact, searchable picker shared by staff booking, rescheduling and patient booking. */
export default function DoctorPicker({ doctors, value, onChange, labelId, disabled = false,
  loading = false, invalid = false, triggerRef }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const localTrigger = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const buttonId = `${uid}-trigger`;
  const optionsId = `${uid}-options`;
  const selected = doctors.find((doctor) => doctor.id === value);
  const filtered = useMemo(() => filterBookingDoctors(doctors, query), [doctors, query]);

  useEffect(() => { if (open) searchRef.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const item = optionsRef.current?.children.item(activeIndex);
    const list = optionsRef.current;
    if (item instanceof HTMLElement && list) {
      // Scroll only the small result list, never the surrounding booking dialog.
      const row = item.getBoundingClientRect();
      const viewport = list.getBoundingClientRect();
      if (row.bottom > viewport.bottom) list.scrollTop += row.bottom - viewport.bottom;
      else if (row.top < viewport.top) list.scrollTop -= viewport.top - row.top;
    }
  }, [open, activeIndex, filtered]);

  function showOptions() {
    if (disabled) return;
    setQuery('');
    setActiveIndex(Math.max(0, doctors.findIndex((doctor) => doctor.id === value)));
    setOpen(true);
  }

  function closeOptions(restoreFocus = false) {
    setOpen(false);
    setQuery('');
    if (restoreFocus) localTrigger.current?.focus({ preventScroll: true });
  }

  function choose(doctor: DoctorProfileResponse) {
    onChange(doctor.id);
    closeOptions(true);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation(); // Do not close the entire booking dialog.
      closeOptions(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (filtered.length) {
        setActiveIndex((index) => (index + (event.key === 'ArrowDown' ? 1 : filtered.length - 1)) % filtered.length);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault(); // Enter must never submit the parent booking form.
      if (filtered[activeIndex]) choose(filtered[activeIndex]);
    }
  }

  return <div ref={containerRef} className={`doctor-picker${open ? ' is-open' : ''}`}
    onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) closeOptions(); }}>
    <button type="button" className="doctor-picker-trigger" id={buttonId} ref={(element) => {
      localTrigger.current = element;
      if (typeof triggerRef === 'function') triggerRef(element);
      else if (triggerRef) triggerRef.current = element;
    }} aria-labelledby={`${labelId} ${buttonId}`} aria-haspopup="listbox" aria-expanded={open}
      aria-controls={open ? optionsId : undefined} aria-invalid={invalid || undefined}
      disabled={disabled} onClick={() => open ? closeOptions() : showOptions()}>
      <span className="doctor-picker-trigger-copy">
        {selected ? <><strong>{doctorName(selected)}</strong><small>{doctorSpecialty(selected)}</small></>
          : <span className="doctor-picker-placeholder">{loading ? 'Đang tải bác sĩ...' : doctors.length ? 'Tìm và chọn bác sĩ' : 'Chưa có bác sĩ khả dụng'}</span>}
      </span>
      <ChevronDown size={18} aria-hidden="true" className="doctor-picker-chevron" />
    </button>
    {open && <div className="doctor-picker-popover">
      <div className="doctor-picker-search"><Search size={17} aria-hidden="true" />
        <input ref={searchRef} role="combobox" type="search" autoComplete="off"
          aria-label="Tìm bác sĩ theo tên hoặc chuyên khoa" aria-autocomplete="list" aria-expanded={true}
          aria-controls={optionsId} aria-activedescendant={filtered[activeIndex] ? `${uid}-option-${filtered[activeIndex].id}` : undefined}
          placeholder="Nhập tên bác sĩ hoặc chuyên khoa..." value={query}
          onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
          onKeyDown={handleSearchKeyDown} />
      </div>
      <p className="doctor-picker-count" role="status">{filtered.length} bác sĩ phù hợp · ↑ ↓ để chọn, Enter để xác nhận</p>
      <div className="doctor-picker-options" id={optionsId} role="listbox" aria-label="Danh sách bác sĩ" ref={optionsRef}>
        {filtered.map((doctor, index) => <button type="button" role="option" key={doctor.id}
          id={`${uid}-option-${doctor.id}`} tabIndex={-1} aria-selected={doctor.id === value}
          className={`doctor-picker-option${index === activeIndex ? ' is-active' : ''}`}
          onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)}
          onClick={() => choose(doctor)}>
          <span className="doctor-picker-avatar"><Stethoscope size={18} aria-hidden="true" /></span>
          <span className="doctor-picker-option-text"><strong>{doctorName(doctor)}</strong><small>{doctorSpecialty(doctor)}</small></span>
          {doctor.id === value && <Check size={19} className="doctor-picker-check" aria-hidden="true" />}
        </button>)}
        {!filtered.length && <p className="doctor-picker-empty">Không tìm thấy bác sĩ phù hợp. Thử tên hoặc chuyên khoa khác.</p>}
      </div>
    </div>}
  </div>;
}
