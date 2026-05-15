import StatCard from '../../../components/StatCard';
import { dashboardSummaryCards } from '../../../config/dashboard.config';
import type { DashboardResponse } from '../../../types/domain';

type DashboardStatsProps = {
  dashboard: DashboardResponse | null;
};

export default function DashboardStats({ dashboard }: DashboardStatsProps) {
  return (
    <section className="grid stats-grid">
      {dashboardSummaryCards.map((card) => (
        <StatCard
          key={card.metric}
          label={card.label}
          value={dashboard?.[card.metric].length ?? 0}
          detail={card.detail}
          tone={card.tone}
        />
      ))}
    </section>
  );
}
