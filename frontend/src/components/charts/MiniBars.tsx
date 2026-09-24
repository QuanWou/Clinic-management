type MiniBarsProps = {
  values: number[];
  tone?: 'green' | 'blue' | 'orange' | 'purple';
};

export default function MiniBars({ values, tone = 'green' }: MiniBarsProps) {
  const max = Math.max(...values, 1);

  return (
    <div className={`mini-bars mini-bars-${tone}`} aria-hidden="true">
      {values.map((value, index) => (
        <span key={`${value}-${index}`} style={{ height: `${18 + (value / max) * 48}px` }} />
      ))}
    </div>
  );
}
