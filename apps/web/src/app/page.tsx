import Link from 'next/link';
import { getProducts } from '@/lib/api';
import { StatusChip } from '@/components/status-chip';

function formatDate(input: string | null) {
  if (!input) {
    return '待确认';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(input));
}

export default async function HomePage() {
  const products = await getProducts();
  const launchableCount = products.filter((item) => item.status === 'LAUNCHABLE').length;
  const blockedCount = products.filter((item) => item.status === 'BLOCKED').length;

  return (
    <main className="page-shell">
      <section className="hero">
        <span className="eyebrow">Launch Decision V1</span>
        <h1 style={{ fontSize: '44px', lineHeight: 1.05, maxWidth: 820 }}>
          直播间上什么品，不再靠口头追问。
        </h1>
        <p className="muted" style={{ fontSize: '16px', maxWidth: 720 }}>
          按分批到料、共用料分配、BOM 当前生效版本与最低开工门槛，汇总单品当前可上架量、短期新增量和下一批预计时间。
        </p>
        <div>
          <Link href="/operations" className="action-button" style={{ display: 'inline-flex' }}>
            进入操作台
          </Link>
        </div>
      </section>

      <section className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="panel stat-card">
          <div className="muted">单品总数</div>
          <div className="stat-value">{products.length}</div>
        </div>
        <div className="panel stat-card">
          <div className="muted">当前可上架</div>
          <div className="stat-value">{launchableCount}</div>
        </div>
        <div className="panel stat-card">
          <div className="muted">当前受阻</div>
          <div className="stat-value">{blockedCount}</div>
        </div>
      </section>

      <section className="panel list-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, gap: 12 }}>
          <div>
            <h2 className="section-title">单品结果列表</h2>
            <p className="muted" style={{ margin: 0 }}>
              首页只展示运营决策需要的结果，不展开完整计算链路。
            </p>
          </div>
        </div>

        <table className="product-table">
          <thead>
            <tr>
              <th>单品</th>
              <th>当前已可上架</th>
              <th>短期新增</th>
              <th>下一批预计上架</th>
              <th>状态</th>
              <th>关键原因</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  <Link href={`/products/${product.id}`}>
                    <strong>{product.name}</strong>
                    <div className="muted">{product.code}</div>
                  </Link>
                </td>
                <td>{product.launchableQtyNow}</td>
                <td>{product.shortTermIncrementQty}</td>
                <td>{formatDate(product.nextLaunchDate)}</td>
                <td>
                  <StatusChip state={product.status} />
                </td>
                <td className="muted">{product.reasonSummary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
