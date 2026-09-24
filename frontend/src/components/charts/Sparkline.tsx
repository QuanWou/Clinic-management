type SparklineProps = {
  values: number[];
  tone?: 'green' | 'blue' | 'purple';
};

export default function Sparkline({ values, tone = 'green' }: SparklineProps) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const width = 180;
  const height = 76;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / Math.max(max - min, 1)) * (height - 14) - 7;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className={`sparkline sparkline-${tone}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend line">
      <polyline points={points} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      {values.map((value, index) => {
        const x = (index / Math.max(values.length - 1, 1)) * width;
        const y = height - ((value - min) / Math.max(max - min, 1)) * (height - 14) - 7;
        return <circle key={`${value}-${index}`} cx={x} cy={y} r="3.8" fill="currentColor" />;
      })}
    </svg>
  );
}
