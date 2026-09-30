import type { StatusTone } from '../types/view';
import { statusLabel } from '../utils/locale';

type BadgeProps = {
  children: string;
  tone?: StatusTone;
};

export default function Badge({ children, tone = children }: BadgeProps) {
  return <span className={`badge badge-${normalizeTone(tone)}`}>{statusLabel(children)}</span>;
}

function normalizeTone(tone: StatusTone): string {
  return tone.toLowerCase().replace(/\s|_/g, '-');
}
