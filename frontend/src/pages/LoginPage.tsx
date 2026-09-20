import { useState } from 'react';
import { login, register } from '../api/auth';
import { authConfig } from '../config/auth.config';
import LoginForm from '../features/auth/components/LoginForm';
import RegisterForm from '../features/auth/components/RegisterForm';
import type { LoginRequest, RegisterRequest } from '../types/domain';

export type LoginPageProps = {
  onLogin: () => Promise<void> | void;
};

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const copy = authConfig[mode];

  async function handleSubmit(request: LoginRequest) {
    setError(null);
    setLoading(true);

    try {
      await login(request);
      await onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(request: RegisterRequest) {
    setError(null);
    setLoading(true);

    try {
      await register(request);
      await onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: 'login' | 'register') {
    setMode(nextMode);
    setError(null);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="muted">{copy.subtitle}</p>

        {mode === 'login' ? (
          <LoginForm error={error} loading={loading} onSubmit={handleSubmit} />
        ) : (
          <RegisterForm error={error} loading={loading} onSubmit={handleRegister} />
        )}

        <div className="auth-switch">
          <span>{mode === 'login' ? 'New patient?' : 'Already have an account?'}</span>
          <button
            className="ghost-button"
            type="button"
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Create account' : 'Sign in'}
          </button>
        </div>
      </section>
    </main>
  );
}
