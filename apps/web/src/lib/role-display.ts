import type { AuthUser } from '@/lib/types';

export function roleTitleLabel(role: AuthUser['role']) {
  if (role === 'ADMIN') {
    return '项目管理';
  }

  if (role === 'PURCHASER') {
    return '采购端';
  }

  return '运营';
}

export function rolePageTitle(role: AuthUser['role']) {
  return `上架决策系统 V1 - ${roleTitleLabel(role)}`;
}
