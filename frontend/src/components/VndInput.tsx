import {useId, useState} from 'react';
import {formatVnd, parseVnd} from '../utils/vnd';

export function VndInput({value, onChange, label, allowZero = false, required = false}: {
  value: string; onChange: (value: string) => void; label: string; allowZero?: boolean; required?: boolean;
}) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  let amount: number | undefined, error = '';
  try { if (value.trim()) amount = parseVnd(value, allowZero); }
  catch (cause) { error = (cause as Error).message; }
  return <>
    <input type="text" inputMode="numeric" required={required} value={value} maxLength={24}
      aria-label={label} aria-describedby={id} aria-invalid={touched && !!error || undefined}
      onBlur={() => setTouched(true)} onChange={event => onChange(event.target.value)}/>
    <small id={id} aria-live="polite">{amount !== undefined
      ? `Số tiền: ${formatVnd(amount)}`
      : touched && error ? error : 'Ví dụ: 1000 hoặc 1.000 = một nghìn đồng.'}</small>
  </>;
}
