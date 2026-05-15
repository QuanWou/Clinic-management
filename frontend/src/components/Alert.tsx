import type { ReactNode } from 'react';

type AlertProps = {
  children: ReactNode;
  tone?: 'error' | 'info';
};

export default function Alert({ children, tone = 'info' }: AlertProps) {
  return <div className={`alert alert-${tone}`}>{children}</div>;
}
