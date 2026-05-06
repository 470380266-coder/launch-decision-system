import Link from 'next/link';
import { getProducts } from '@/lib/api';
import { HomeActions } from '@/components/home-actions';
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
  const launchableCount = products.filter((item) => item.remainingAllocatableQty > 0).length;
  const blockedCount = products.filter((item) => item.status === 'BLOCKED').length;

  return (
    <main className="home-page">
      <header className="home-topbar">
        <div className="home-topbar-inner">
          <div className="home-brand">
            <span className="home-brand-mark">备</span>
            <span>直播间备货系统</span>
            <span className="home-breadcrumb-separator">/</span>
            <span className="home-breadcrumb-current">上架决策看板</span>
          </div>
          <HomeActions />
        </div>
      </header>

      <div className="home-content">
        <h1 className="home-page-title">上架决策看板 V1</h1>

        <section className="home-stats-grid">
          <div className="home-stat-card">
            <div className="home-stat-label">单品总数</div>
            <div className="home-stat-value">{products.length}</div>
          </div>
          <div className="home-stat-card">
            <div className="home-stat-label">本轮可分配</div>
            <div className="home-stat-value home-stat-value-blue">{launchableCount}</div>
          </div>
          <div className="home-stat-card">
            <div className="home-stat-label">当前受阻</div>
            <div className="home-stat-value home-stat-value-red">{blockedCount}</div>
          </div>
        </section>

        <section className="home-table-card">
          <div className="home-table-header">
            <h2>单品结果列表</h2>
            <p>首页只展示运营决策需要的结果,不展开完整计算链路。</p>
          </div>

          <div className="home-table-scroll">
            <table className="home-product-table">
              <thead>
                <tr>
                  <th>单品</th>
                  <th>本轮可上架量</th>
                  <th>已分配上架量</th>
                  <th>剩余可分配上架量</th>
                  <th>下一批预计上架</th>
                  <th>状态</th>
                  <th>关键原因</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <Link href={`/products/${product.id}`} className="home-product-link">
                        <strong>{product.name}</strong>
                        <span>{product.code}</span>
                      </Link>
                    </td>
                    <td>{product.roundLaunchQty}</td>
                    <td>{product.allocatedLaunchQty}</td>
                    <td>{product.remainingAllocatableQty}</td>
                    <td>{formatDate(product.nextLaunchDate)}</td>
                    <td>
                      <StatusChip state={product.status} variant="plain" />
                    </td>
                    <td className="home-table-muted">{product.reasonSummary}</td>
                    <td>
                      <Link href={`/products/${product.id}`} className="home-detail-link">
                        查看详情
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="home-mobile-list">
            {products.map((product) => (
              <article className="home-mobile-item" key={product.id}>
                <div className="home-mobile-title-row">
                  <div className="home-mobile-product">
                    <strong>{product.name}</strong>
                    <span>{product.code}</span>
                  </div>
                  <StatusChip state={product.status} variant="plain" />
                </div>
                <div className="home-mobile-metrics">
                  <div>
                    <span>本轮可上架</span>
                    <strong>{product.roundLaunchQty}</strong>
                  </div>
                  <div>
                    <span>已分配</span>
                    <strong>{product.allocatedLaunchQty}</strong>
                  </div>
                  <div>
                    <span>剩余可分配</span>
                    <strong>{product.remainingAllocatableQty}</strong>
                  </div>
                  <div>
                    <span>下一批</span>
                    <strong>{formatDate(product.nextLaunchDate)}</strong>
                  </div>
                </div>
                <p>原因：{product.reasonSummary}</p>
                <Link href={`/products/${product.id}`} className="home-mobile-detail-link">
                  查看详情
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
