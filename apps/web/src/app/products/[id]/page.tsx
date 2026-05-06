import { notFound } from 'next/navigation';
import { HomeActions } from '@/components/home-actions';
import { ProductDetailView } from '@/components/product-detail-view';
import { getProductDetail } from '@/lib/api';

export const dynamic = 'force-dynamic';

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
    <main className="detail-page">
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

      <ProductDetailView detail={detail} />
    </main>
  );
}
