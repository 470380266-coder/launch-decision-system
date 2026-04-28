import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StatusChip } from '@/components/status-chip';
import { getProductDetail, getProducts } from '@/lib/api';

function formatDate(input: string | null) {
  if (!input) {
    return '待确认';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(input));
}

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product) => ({ id: product.id }));
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getProductDetail(id);

  if (!detail) {
    notFound();
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <Link href="/" className="muted">
          返回列表
        </Link>
        <span className="eyebrow">Product Detail</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '40px', lineHeight: 1.1 }}>{detail.name}</h1>
          <StatusChip state={detail.state} />
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {detail.code} · {detail.reasonSummary}
        </p>
      </section>

      <section className="row-grid">
        <div className="panel stat-card">
          <div className="muted">当前已可上架数量</div>
          <div className="stat-value">{detail.launchableQtyNow}</div>
        </div>
        <div className="panel stat-card">
          <div className="muted">短期新增可上架量</div>
          <div className="stat-value">{detail.shortTermIncrementQty}</div>
        </div>
        <div className="panel stat-card">
          <div className="muted">下一批预计上架时间</div>
          <div className="stat-value" style={{ fontSize: '24px' }}>
            {formatDate(detail.nextLaunchDate)}
          </div>
        </div>
      </section>

      <section className="detail-grid">
        <div className="stack">
          <div className="panel list-card">
            <h2 className="section-title">生产批次</h2>
            <div className="list">
              {detail.productionBatches.map((batch) => (
                <div className="list-item" key={batch.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <strong>{batch.batchNo}</strong>
                    <span className="muted">{batch.status}</span>
                  </div>
                  <p className="muted" style={{ marginBottom: 8 }}>
                    计划数量 {batch.plannedQty}，预计上架 {formatDate(batch.predictedLaunchDate)}
                  </p>
                  <p style={{ margin: '0 0 8px' }}>{batch.blockingReason ?? '当前批次无阻塞说明'}</p>
                  <div className="muted">
                    共用料分配：
                    {batch.sharedAllocations.length
                      ? batch.sharedAllocations
                          .map((item) => `${item.materialName} ${item.allocatedQty}`)
                          .join('，')
                      : '暂无'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel list-card">
            <h2 className="section-title">当前 BOM</h2>
            <div className="list">
              {detail.bom?.items.map((item) => (
                <div className="list-item" key={item.id}>
                  <strong>{item.materialName}</strong>
                  <div className="muted">
                    {item.materialCode} · 单耗 {item.unitUsage} · {item.isSharedMaterial ? '共用料' : '非共用料'}
                  </div>
                </div>
              )) ?? <div className="muted">暂无生效 BOM</div>}
            </div>
          </div>
        </div>

        <aside className="stack">
          <div className="panel list-card">
            <h2 className="section-title">受阻批次</h2>
            <div className="list">
              {detail.blockedBatches.length ? (
                detail.blockedBatches.map((batch) => (
                  <div className="list-item" key={batch.id}>
                    <strong>{batch.batchNo}</strong>
                    <div className="muted">{batch.blockingReason ?? '待补充原因'}</div>
                  </div>
                ))
              ) : (
                <div className="muted">当前无受阻批次</div>
              )}
            </div>
          </div>

          <div className="panel list-card">
            <h2 className="section-title">实际结果回填</h2>
            <div className="list">
              {detail.productionBatches.map((batch) => (
                <div className="list-item" key={`${batch.id}-actual`}>
                  <strong>{batch.batchNo}</strong>
                  <div className="muted">
                    实际开工：{formatDate(batch.actual?.startAt ?? null)}
                  </div>
                  <div className="muted">
                    实际完成：{formatDate(batch.actual?.finishAt ?? null)}
                  </div>
                  <div className="muted">
                    实际上架：{formatDate(batch.actual?.launchAt ?? null)}
                  </div>
                  <div className="muted">
                    实际上架数量：{batch.actual?.launchQty ?? '待回填'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
