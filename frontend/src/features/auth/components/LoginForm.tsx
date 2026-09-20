import { FormEvent, useState } from 'react';
import Alert from '../../../components/Alert';
import { authConfig } from '../../../config/auth.config';
import type { LoginRequest } from '../../../types/domain';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';

type LoginFormProps = {
  error: string | null;
  loading: boolean;
  onSubmit: (request: LoginRequest) => Promise<void> | void;
};

export default function LoginForm({ error, loading, onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const copy = authConfig.login;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({ email, password });
  }

  return (
    <form onSubmit={handleSubmit} className="form-stack">
      <div className="form-field">
        <label htmlFor="login-email">{copy.emailLabel}</label>
        <span className="field-wrap"><Mail size={18} aria-hidden="true" /><input
          id="login-email"
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={copy.emailPlaceholder}
          required
        /></span>
      </div>

      <div className="form-field">
        <label htmlFor="login-password">{copy.passwordLabel}</label>
        <span className="field-wrap"><LockKeyhole size={18} aria-hidden="true" /><input
          id="login-password"
          type={showPassword ? 'text' : 'password'}
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={copy.passwordPlaceholder}
          required
        /><button className="field-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <button type="submit" className="submit-button" disabled={loading} aria-busy={loading}>
        {loading ? copy.loadingLabel : copy.submitLabel}
      </button>
    </form>
  );
}
