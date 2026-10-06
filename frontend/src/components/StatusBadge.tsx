type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export function StatusBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`status-badge status-${tone}`}>{children}</span>;
}
