import { FormEvent, useState } from 'react';
import Alert from '../../../components/Alert';
import { authConfig } from '../../../config/auth.config';
import type { LoginRequest } from '../../../types/domain';

type LoginFormProps = {
  error: string | null;
  loading: boolean;
  onSubmit: (request: LoginRequest) => Promise<void> | void;
};

export default function LoginForm({ error, loading, onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const copy = authConfig.login;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({ email, password });
  }

  return (
    <form onSubmit={handleSubmit} className="form-stack">
      <label>
        {copy.emailLabel}
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={copy.emailPlaceholder}
          required
        />
      </label>

      <label>
        {copy.passwordLabel}
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={copy.passwordPlaceholder}
          required
        />
      </label>

      {error && <Alert tone="error">{error}</Alert>}

      <button type="submit" disabled={loading}>
        {loading ? copy.loadingLabel : copy.submitLabel}
      </button>
    </form>
  );
}
