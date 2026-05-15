import { useState } from 'react';
import { login } from '../api/auth';
import { authConfig } from '../config/auth.config';
import LoginForm from '../features/auth/components/LoginForm';
import type { LoginRequest } from '../types/domain';

export type LoginPageProps = {
  onLogin: () => void;
};

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const copy = authConfig.login;

  async function handleSubmit(request: LoginRequest) {
    setError(null);
    setLoading(true);

    try {
      await login(request);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="muted">{copy.subtitle}</p>

        <LoginForm error={error} loading={loading} onSubmit={handleSubmit} />
      </section>
    </main>
  );
}
