type StatCardProps = {
  label: string;
  value: number | string;
  detail: string;
  tone?: 'green' | 'blue' | 'orange';
};

export default function StatCard({ label, value, detail, tone = 'green' }: StatCardProps) {
  return (
    <article className={`stat-card stat-card-${tone}`}>
      <span className="stat-card-label">{label}</span>
      <strong className="stat-card-value">{value}</strong>
      <p className="stat-card-detail">{detail}</p>
    </article>
  );
}
