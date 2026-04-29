import Link from 'next/link';
import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <Link href="/" className="muted">
          返回首页
        </Link>
        <span className="eyebrow">Auth</span>
        <h1 style={{ fontSize: '40px', lineHeight: 1.1, maxWidth: 760 }}>
          登录后按账号角色进入对应界面。
        </h1>
      </section>
      <LoginForm />
    </main>
  );
}
