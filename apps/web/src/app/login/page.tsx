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
          先登录，再进入采购和管理员操作台。
        </h1>
      </section>
      <LoginForm />
    </main>
  );
}
