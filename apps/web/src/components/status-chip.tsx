import { ProductState } from '@/lib/types';

const statusMap: Record<ProductState, { label: string; className: string }> = {
  LAUNCHABLE: { label: '可上架', className: 'status-launchable' },
  SCHEDULABLE: { label: '可预排', className: 'status-schedulable' },
  BLOCKED: { label: '受阻', className: 'status-blocked' },
  COMPLETED: { label: '已完结', className: 'status-completed' },
  TARGET_SHORTFALL: { label: '目标未达成', className: 'status-blocked' },
  SHORT_CLOSED: { label: '短缺完结', className: 'status-blocked' },
};

export function StatusChip({
  state,
  variant = 'pill',
}: {
  state: ProductState;
  variant?: 'pill' | 'plain';
}) {
  const config = statusMap[state];

  return (
    <span className={`status-chip ${config.className} status-chip-${variant}`}>
      {config.label}
    </span>
  );
}
