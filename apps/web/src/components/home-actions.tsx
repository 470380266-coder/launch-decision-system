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
    return <div className="home-account-panel">识别中...</div>;
  }

  if (user) {
    const canOperate = user.role === 'ADMIN' || user.role === 'PURCHASER';

    return (
      <div className="home-account-panel">
        <span className="home-role-badge">{roleLabel(user.role)}</span>
        <span className="home-username">{displayUsername(user.username)}</span>
        {canOperate ? (
          <Link href="/operations" className="home-account-button">
            进入操作台
          </Link>
        ) : (
          null
        )}
        <button className="home-logout-button" onClick={logout} type="button">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M10 6H6v12h4" />
            <path d="M14 8l4 4-4 4" />
            <path d="M8 12h10" />
          </svg>
          退出
        </button>
      </div>
    );
  }

  return (
    <div className="home-account-panel">
      <span className="home-username">未登录</span>
      <Link href="/login" className="home-account-button">
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
    return '采购员';
  }

  return '运营';
}

function displayUsername(username: string) {
  return username === 'operator' ? 'ops' : username;
}
