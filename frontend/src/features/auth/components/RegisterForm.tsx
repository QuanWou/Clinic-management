import { FormEvent, useState } from 'react';
import Alert from '../../../components/Alert';
import { authConfig } from '../../../config/auth.config';
import type { RegisterRequest } from '../../../types/domain';

type RegisterFormProps = {
  error: string | null;
  loading: boolean;
  onSubmit: (request: RegisterRequest) => Promise<void> | void;
};

export default function RegisterForm({ error, loading, onSubmit }: RegisterFormProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const copy = authConfig.register;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    setValidationError(null);
    await onSubmit({
      email,
      password,
      fullName,
      phone: phone.trim() || undefined
    });
  }

  return (
    <form onSubmit={handleSubmit} className="form-stack">
      <label>
        Full name
        <input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Nguyen Van An"
          maxLength={255}
          required
        />
      </label>

      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="patient@example.com"
          required
        />
      </label>

      <label>
        Phone <span className="optional-label">Optional</span>
        <input
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="0901234567"
          maxLength={50}
        />
      </label>

      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
          minLength={8}
          maxLength={100}
          required
        />
      </label>

      <label>
        Confirm password
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Repeat your password"
          minLength={8}
          required
        />
      </label>

      {(validationError || error) && <Alert tone="error">{validationError ?? error}</Alert>}

      <button type="submit" disabled={loading}>
        {loading ? copy.loadingLabel : copy.submitLabel}
      </button>
    </form>
  );
}
