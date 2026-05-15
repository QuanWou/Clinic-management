import type { StatusTone } from '../types/view';

type BadgeProps = {
  children: string;
  tone?: StatusTone;
};

export default function Badge({ children, tone = children }: BadgeProps) {
  return <span className={`badge badge-${normalizeTone(tone)}`}>{children}</span>;
}

function normalizeTone(tone: StatusTone): string {
  return tone.toLowerCase().replace(/\s|_/g, '-');
}
