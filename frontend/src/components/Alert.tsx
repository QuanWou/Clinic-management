import type { ReactNode } from 'react';

type AlertProps = {
  children: ReactNode;
  tone?: 'error' | 'info';
};

export default function Alert({ children, tone = 'info' }: AlertProps) {
  const isError = tone === 'error';
  return (
    <div
      className={`alert alert-${tone}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      {children}
    </div>
  );
}
