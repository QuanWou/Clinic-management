import { ArrowDownRight, ArrowUpRight } from "lucide-react";

interface Props {
  label: string;
  value: string;
  detail: string;
  trend?: string;
}

export function KpiCard({ label, value, detail, trend }: Props) {
  const down = trend?.startsWith("-");
  return (
    <article className="kpi-card">
      <div className="kpi-head">
        <span>{label}</span>
        {trend && (
          <span className={`trend-chip ${down ? "trend-down" : "trend-up"}`}>
            {down ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
            {trend}
          </span>
        )}
      </div>
      <strong className="kpi-value">{value}</strong>
      <span className="kpi-detail">{detail}</span>
    </article>
  );
}
