import { OperationsConsole } from '@/components/operations-console';

export default function OperationsPage() {
  return (
    <main className="ops-shell">
      <section className="ops-nav">
        <div>
          <div className="ops-brand">Launch Decision</div>
          <div className="field-hint">分批到料驱动的上架决策系统</div>
        </div>
        <nav className="ops-nav-tabs" aria-label="工作台导航">
          <a className="ops-nav-item" href="/">
            上架看板
          </a>
          <a className="ops-nav-item active" href="/operations">
            角色工作台
          </a>
        </nav>
      </section>

      <OperationsConsole initialData={null} />
    </main>
  );
}
