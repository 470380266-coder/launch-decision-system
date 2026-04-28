import Link from 'next/link';
import { OperationsConsole } from '@/components/operations-console';

export default function OperationsPage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <Link href="/" className="muted">
          返回结果列表
        </Link>
        <span className="eyebrow">Operations</span>
        <h1 style={{ fontSize: '40px', lineHeight: 1.1, maxWidth: 880 }}>
          采购录入、共用料分配、批次状态调整，现在走登录和角色限制。
        </h1>
        <p className="muted" style={{ maxWidth: 760 }}>
          采购可录到货并查看待生产批次；管理员额外拥有共用料分配和批次状态调整权限。
        </p>
      </section>

      <OperationsConsole initialData={null} />
    </main>
  );
}
