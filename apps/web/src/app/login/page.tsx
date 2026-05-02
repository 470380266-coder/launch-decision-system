import { LoginForm } from '@/components/login-form';

const featureCards = [
  {
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
      </svg>
    ),
    title: '运营',
    description: '查看上架决策看板,跟踪单品可上架进度。',
  },
  {
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M9 3h6l1 2h3v16H5V5h3z" />
        <path d="M9 9h6M9 13h6M9 17h4" />
      </svg>
    ),
    title: '管理员',
    description: '维护批次、共用料分配与单品 BOM。',
  },
  {
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" />
        <path d="M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      </svg>
    ),
    title: '采购员',
    description: '跟进子物料采购、到货状态与差值。',
  },
];

export default function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-layout">
        <section className="login-intro" aria-labelledby="login-title">
          <div className="login-brand">
            <span className="login-brand-mark">备</span>
            <span>直播间备货系统</span>
          </div>
          <h1 id="login-title">直播间进度追踪器</h1>
          <p>
            按分批到料、共用料分配、BOM 与开工门槛,统一汇总单品可上架量、短期新增量与下一批预计时间。
          </p>
          <div className="login-feature-grid">
            {featureCards.map((card) => (
              <article className="login-feature-card" key={card.title}>
                <span className="login-feature-icon">{card.icon}</span>
                <h2>{card.title}</h2>
                <p>{card.description}</p>
              </article>
            ))}
          </div>
        </section>
        <LoginForm />
      </div>
    </main>
  );
}
