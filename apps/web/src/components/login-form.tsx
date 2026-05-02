'use client';

import { type FormEvent, useState, useTransition } from 'react';
import { login } from '@/lib/api';

const TOKEN_KEY = 'launch-decision-token';

const roleOptions = [
  { key: 'viewer', label: '运营', username: 'ops', loginUsername: 'operator' },
  { key: 'admin', label: '管理员', username: 'admin', loginUsername: 'admin' },
  {
    key: 'purchaser',
    label: '采购员',
    username: 'purchase_yi',
    loginUsername: 'purchaser_a',
  },
] as const;

type RoleKey = (typeof roleOptions)[number]['key'];

export function LoginForm() {
  const [selectedRole, setSelectedRole] = useState<RoleKey>('viewer');
  const [username, setUsername] = useState('ops');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function selectRole(roleKey: RoleKey) {
    const role = roleOptions.find((option) => option.key === roleKey);
    if (!role) {
      return;
    }

    setSelectedRole(role.key);
    setUsername(role.username);
    setError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const selectedRoleOption = roleOptions.find(
          (option) => option.key === selectedRole,
        );
        const requestUsername =
          selectedRoleOption?.username === username
            ? selectedRoleOption.loginUsername
            : username;
        const requestPassword =
          process.env.NODE_ENV === 'production' ? password : 'dev-only';
        const result = await login(requestUsername, requestPassword);
        window.localStorage.setItem(TOKEN_KEY, result.accessToken);
        window.location.href =
          result.user.role === 'ADMIN' || result.user.role === 'PURCHASER'
            ? '/operations'
            : '/';
      } catch {
        setError('登录失败，请检查用户名和密码');
      }
    });
  }

  return (
    <form className="login-card" onSubmit={handleSubmit}>
      <div className="login-card-header">
        <h2>登录</h2>
        <p>选择你的角色并使用账号登录。</p>
      </div>
      <fieldset className="login-role-field">
        <legend>角色</legend>
        <div className="login-role-tabs">
          {roleOptions.map((role) => (
            <button
              aria-pressed={selectedRole === role.key}
              className={selectedRole === role.key ? 'active' : ''}
              disabled={isPending}
              key={role.key}
              onClick={() => selectRole(role.key)}
              type="button"
            >
              {role.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="login-field">
        <span>
          <b>*</b> 账号
        </span>
        <input
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>
      <label className="login-field">
        <span>
          <b>*</b> 密码
        </span>
        <input
          autoComplete="current-password"
          placeholder="请输入密码"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <button className="login-submit" disabled={isPending} type="submit">
        {isPending ? '登录中...' : '登录'}
      </button>
      {error ? <div className="login-error">{error}</div> : null}
      <p className="login-help">演示环境,任意密码即可登录。切换角色需退出后重新登录。</p>
    </form>
  );
}
