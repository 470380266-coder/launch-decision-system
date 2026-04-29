'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCurrentUser } from '@/lib/api';
import { AuthUser } from '@/lib/types';

const TOKEN_KEY = 'launch-decision-token';

export function HomeActions() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setLoading(false);
      return;
    }

    setHasToken(true);
    void (async () => {
      try {
        setUser(await getCurrentUser(token));
      } catch {
        window.localStorage.removeItem(TOKEN_KEY);
        setHasToken(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY);
    window.location.reload();
  }

  if (loading) {
    return <div className="role-panel">正在识别当前账号权限...</div>;
  }

  if (user) {
    const canOperate = user.role === 'ADMIN' || user.role === 'PURCHASER';

    return (
      <div className="role-panel">
        <div>
          <div className="field-hint">当前登录</div>
          <strong>
            {user.name} · {roleLabel(user.role)}
          </strong>
          <div className="field-hint">{user.username}</div>
        </div>
        {canOperate ? (
          <Link href="/operations" className="action-button" style={{ display: 'inline-flex' }}>
            进入操作台
          </Link>
        ) : (
          <div className="permission-note">仅可查看看板，无操作台权限</div>
        )}
        <button className="secondary-button" onClick={logout} type="button">
          退出
        </button>
      </div>
    );
  }

  return (
    <div className="role-panel">
      <div>
        <div className="field-hint">当前未登录</div>
        <strong>运营看板可直接查看</strong>
      </div>
      <Link href="/login" className="secondary-button" style={{ display: 'inline-flex' }}>
        {hasToken ? '重新登录' : '操作人员登录'}
      </Link>
    </div>
  );
}

function roleLabel(role: AuthUser['role']) {
  if (role === 'ADMIN') {
    return '管理员';
  }

  if (role === 'PURCHASER') {
    return '采购';
  }

  return '运营查看';
}
