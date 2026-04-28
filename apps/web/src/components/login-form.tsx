'use client';

import { useState, useTransition } from 'react';
import { login } from '@/lib/api';

const TOKEN_KEY = 'launch-decision-token';

export function LoginForm() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('dev-only');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const result = await login(username, password);
        window.localStorage.setItem(TOKEN_KEY, result.accessToken);
        window.location.href = '/operations';
      } catch {
        setError('登录失败，请检查用户名和密码');
      }
    });
  }

  return (
    <form className="panel list-card form-grid" onSubmit={handleSubmit}>
      <div className="field-full">
        <h2 className="section-title">登录操作台</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          当前演示账号：`admin / dev-only`，`purchaser_a / dev-only`
        </p>
      </div>
      <label className="field">
        <span>用户名</span>
        <input value={username} onChange={(event) => setUsername(event.target.value)} />
      </label>
      <label className="field">
        <span>密码</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <div className="field-full">
        <button className="action-button" disabled={isPending} type="submit">
          {isPending ? '登录中...' : '登录'}
        </button>
      </div>
      {error ? <div className="field-full error-text">{error}</div> : null}
    </form>
  );
}

