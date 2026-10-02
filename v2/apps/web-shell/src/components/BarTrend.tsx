import type { ChartPoint } from "../types/contracts";

interface Props {
  title: string;
  description: string;
  data: ChartPoint[];
}

export function BarTrend({ title, description, data }: Props) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <section className="chart-card" aria-labelledby="chart-title">
      <div className="section-heading">
        <div>
          <h2 id="chart-title">{title}</h2>
          <p>{description}</p>
        </div>
        <span className="demo-chip">Dữ liệu minh họa</span>
      </div>
      <div className="bar-chart" role="img" aria-label={`${title}. ${data.map((x) => `${x.label}: ${x.value}`).join(", ")}`}>
        {data.map((point) => (
          <div className="bar-column" key={point.label}>
            <div className="bar-track">
              <div className="bar-fill" style={{ height: `${Math.max(8, (point.value / max) * 100)}%` }} />
            </div>
            <strong>{point.value}</strong>
            <span>{point.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
