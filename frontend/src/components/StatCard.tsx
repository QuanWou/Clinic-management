type StatCardProps = {
  label: string;
  value: number | string;
  detail: string;
  tone?: 'green' | 'blue' | 'orange';
};

export default function StatCard({ label, value, detail, tone = 'green' }: StatCardProps) {
  return (
    <article className={`stat-card stat-card-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}
