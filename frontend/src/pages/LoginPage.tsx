import { useState } from 'react';
import { login } from '../api/auth';
import { authConfig } from '../config/auth.config';
import LoginForm from '../features/auth/components/LoginForm';
import type { LoginRequest } from '../types/domain';
import { Activity, CalendarCheck2, HeartPulse, ShieldCheck } from 'lucide-react';

export type LoginPageProps = {
  onLogin: () => void;
  sessionError?: string | null;
};

export default function LoginPage({ onLogin, sessionError }: LoginPageProps) {
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
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <aside className="auth-intro" aria-label="Giới thiệu hệ thống quản lý phòng khám">
        <div className="auth-brand"><span className="brand-mark">+</span><strong>Clinic<span>Quản lý phòng khám</span></strong></div>
        <div className="auth-intro-copy">
          <span className="auth-pill"><Activity size={15} aria-hidden="true" /> Một hệ thống quản lý thống nhất</span>
          <h2>Chăm sóc tốt hơn, quản lý rõ ràng hơn.</h2>
          <p>Lịch hẹn, thông tin bệnh nhân và hoạt động khám chữa bệnh trong cùng một hệ thống dễ theo dõi.</p>
          <div className="auth-features"><span><CalendarCheck2 size={19} aria-hidden="true" /> Theo dõi lịch hẹn dễ dàng</span><span><HeartPulse size={19} aria-hidden="true" /> Quy trình khám chữa bệnh rõ ràng</span><span><ShieldCheck size={19} aria-hidden="true" /> Truy cập theo tài khoản</span></div>
        </div>
        <p className="auth-intro-foot">Clinic · Cổng thông tin nhân viên và bệnh nhân</p>
      </aside>
      <section className="auth-card">
        <div className="auth-mobile-brand"><span className="brand-mark">+</span><strong>Clinic</strong></div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="muted">{copy.subtitle}</p>

        <LoginForm error={error ?? sessionError ?? null} loading={loading} onSubmit={handleSubmit} />
        <p className="auth-support">Sử dụng thông tin đăng nhập do quản trị viên phòng khám cung cấp.</p>
      </section>
    </main>
  );
}
