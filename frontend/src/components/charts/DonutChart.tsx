import type { CSSProperties } from 'react';

type DonutChartProps = {
  value: number;
  label: string;
};

export default function DonutChart({ value, label }: DonutChartProps) {
  return (
    <div className="donut" style={{ '--value': value } as CSSProperties}>
      <div>
        <strong>{value.toLocaleString()}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
