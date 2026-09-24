import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  className?: string;
};

export default function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <section className={`page-header${className ? ` ${className}` : ''}`} aria-label={title}>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </section>
  );
}
