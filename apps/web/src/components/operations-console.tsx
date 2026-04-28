'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  createAllocation,
  createReceipt,
  getCurrentUser,
  getOperationsBootstrapAuthed,
  updateBatchStatus,
} from '@/lib/api';
import { AuthUser, OperationBootstrap } from '@/lib/types';

const TOKEN_KEY = 'launch-decision-token';

function formatDate(input: string | null) {
  if (!input) {
    return '待确认';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(input));
}

export function OperationsConsole({
  initialData,
}: {
  initialData: OperationBootstrap | null;
}) {
  const [data, setData] = useState<OperationBootstrap | null>(initialData);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [receiptForm, setReceiptForm] = useState({
    materialId: initialData?.materials[0]?.id ?? '',
    receiptBatchNo: '',
    arrivedQty: 1,
    arrivedAt: new Date().toISOString().slice(0, 16),
    sourceType: 'PURCHASE',
    note: '',
    productId: initialData?.products[0]?.id ?? '',
  });
  const [allocationForm, setAllocationForm] = useState({
    receiptBatchId:
      initialData?.sharedReceiptBatches.find((item) => item.remainingQty > 0)?.id ?? '',
    productionBatchId: initialData?.pendingBatches[0]?.id ?? '',
    allocatedQty: 1,
    note: '',
  });

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_KEY);

    if (!storedToken) {
      setAuthLoading(false);
      return;
    }

    setToken(storedToken);
    void (async () => {
      try {
        const currentUser = await getCurrentUser(storedToken);
        const bootstrap = await getOperationsBootstrapAuthed(storedToken);
        setUser(currentUser);
        setData(bootstrap);
      } catch {
        window.localStorage.removeItem(TOKEN_KEY);
        setError('登录已失效，请重新登录');
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!data) {
      return;
    }

    setReceiptForm((current) => ({
      ...current,
      materialId: current.materialId || data.materials[0]?.id || '',
      productId: current.productId || data.products[0]?.id || '',
    }));

    setAllocationForm((current) => ({
      ...current,
      receiptBatchId:
        current.receiptBatchId ||
        data.sharedReceiptBatches.find((item) => item.remainingQty > 0)?.id ||
        '',
      productionBatchId: current.productionBatchId || data.pendingBatches[0]?.id || '',
    }));
  }, [data]);

  const selectedMaterial = useMemo(
    () => data?.materials.find((material) => material.id === receiptForm.materialId),
    [data, receiptForm.materialId],
  );
  const selectedReceipt = useMemo(
    () =>
      data?.sharedReceiptBatches.find(
        (receipt) => receipt.id === allocationForm.receiptBatchId,
      ),
    [allocationForm.receiptBatchId, data],
  );
  const selectedBatch = useMemo(
    () => data?.pendingBatches.find((batch) => batch.id === allocationForm.productionBatchId),
    [allocationForm.productionBatchId, data],
  );

  async function refreshData() {
    if (!token) {
      throw new Error('Missing auth token');
    }

    const nextData = await getOperationsBootstrapAuthed(token);
    setData(nextData);
  }

  function handleReceiptSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        if (!token) {
          throw new Error('Missing auth token');
        }
        await createReceipt({
          ...receiptForm,
          arrivedQty: Number(receiptForm.arrivedQty),
          productId: receiptForm.productId || undefined,
          note: receiptForm.note || undefined,
        }, token);
        await refreshData();
        setMessage('到货批次已录入');
        setReceiptForm((current) => ({
          ...current,
          receiptBatchNo: '',
          arrivedQty: 1,
          note: '',
        }));
      } catch (submissionError) {
        setError(
          submissionError instanceof Error ? submissionError.message : '到货录入失败',
        );
      }
    });
  }

  function handleAllocationSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        if (!token) {
          throw new Error('Missing auth token');
        }
        await createAllocation({
          ...allocationForm,
          allocatedQty: Number(allocationForm.allocatedQty),
          note: allocationForm.note || undefined,
        }, token);
        await refreshData();
        setMessage('共用料分配已保存');
        setAllocationForm((current) => ({
          ...current,
          allocatedQty: 1,
          note: '',
        }));
      } catch (submissionError) {
        setError(
          submissionError instanceof Error ? submissionError.message : '共用料分配失败',
        );
      }
    });
  }

  function handleBatchStatusChange(batchId: string, batchStatus: 'PENDING' | 'PAUSED' | 'COMPLETED') {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        if (!token) {
          throw new Error('Missing auth token');
        }
        await updateBatchStatus(batchId, { batchStatus }, token);
        await refreshData();
        setMessage('批次状态已更新');
      } catch (submissionError) {
        setError(
          submissionError instanceof Error ? submissionError.message : '批次状态更新失败',
        );
      }
    });
  }

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/login';
  }

  if (authLoading) {
    return <div className="panel list-card muted">正在校验登录状态...</div>;
  }

  if (!token || !user || !data) {
    return (
      <div className="panel list-card">
        <p className="muted">你还没有登录，或登录状态已失效。</p>
        <a href="/login" className="action-button" style={{ display: 'inline-flex' }}>
          去登录
        </a>
      </div>
    );
  }

  const isAdmin = user.role === 'ADMIN';

  return (
    <div className="detail-grid" style={{ alignItems: 'start' }}>
      <div className="stack">
        <div className="panel list-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h2 className="section-title" style={{ marginBottom: 6 }}>当前登录</h2>
              <div className="muted">
                {user.name} · {user.username} · {user.role}
              </div>
            </div>
            <button className="secondary-button" onClick={logout} type="button">
              退出登录
            </button>
          </div>
        </div>

        <div className="panel list-card">
          <h2 className="section-title">采购录入到货批次</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            非共用料录入时直接选择归属单品；共用料只记到货事实，不在这里分配。
          </p>
          <form className="form-grid" onSubmit={handleReceiptSubmit}>
            <label className="field">
              <span>子料</span>
              <select
                value={receiptForm.materialId}
                onChange={(event) =>
                  setReceiptForm((current) => ({
                    ...current,
                    materialId: event.target.value,
                  }))
                }
              >
                {data.materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.code} · {material.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>到货批次号</span>
              <input
                value={receiptForm.receiptBatchNo}
                onChange={(event) =>
                  setReceiptForm((current) => ({
                    ...current,
                    receiptBatchNo: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label className="field">
              <span>到货数量</span>
              <input
                min={1}
                type="number"
                value={receiptForm.arrivedQty}
                onChange={(event) =>
                  setReceiptForm((current) => ({
                    ...current,
                    arrivedQty: Number(event.target.value),
                  }))
                }
                required
              />
            </label>
            <label className="field">
              <span>到货时间</span>
              <input
                type="datetime-local"
                value={receiptForm.arrivedAt}
                onChange={(event) =>
                  setReceiptForm((current) => ({
                    ...current,
                    arrivedAt: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label className="field">
              <span>归属单品</span>
              <select
                value={receiptForm.productId}
                onChange={(event) =>
                  setReceiptForm((current) => ({
                    ...current,
                    productId: event.target.value,
                  }))
                }
              >
                <option value="">共用料 / 不归属</option>
                {data.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.code} · {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field-full">
              <span>备注</span>
              <textarea
                rows={3}
                value={receiptForm.note}
                onChange={(event) =>
                  setReceiptForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
              />
            </label>
            <div className="field-hint field-full">
              当前选择：{selectedMaterial?.name ?? '未选择子料'}
            </div>
            <div className="field-full">
              <button className="action-button" disabled={isPending} type="submit">
                {isPending ? '保存中...' : '保存到货批次'}
              </button>
            </div>
          </form>
        </div>

        {isAdmin ? (
          <div className="panel list-card">
            <h2 className="section-title">管理员分配共用料</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              只有已录入、且仍有剩余额度的共用料批次，才会出现在这里。
            </p>
            <form className="form-grid" onSubmit={handleAllocationSubmit}>
              <label className="field">
                <span>共用料到货批次</span>
                <select
                  value={allocationForm.receiptBatchId}
                  onChange={(event) =>
                    setAllocationForm((current) => ({
                      ...current,
                      receiptBatchId: event.target.value,
                    }))
                  }
                >
                  {data.sharedReceiptBatches.map((receipt) => (
                    <option key={receipt.id} value={receipt.id}>
                      {receipt.batchNo} · {receipt.materialName} · 剩余 {receipt.remainingQty}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>待生产批次</span>
                <select
                  value={allocationForm.productionBatchId}
                  onChange={(event) =>
                    setAllocationForm((current) => ({
                      ...current,
                      productionBatchId: event.target.value,
                    }))
                  }
                >
                  {data.pendingBatches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.batchNo} · {batch.productName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>分配数量</span>
                <input
                  min={1}
                  type="number"
                  value={allocationForm.allocatedQty}
                  onChange={(event) =>
                    setAllocationForm((current) => ({
                      ...current,
                      allocatedQty: Number(event.target.value),
                    }))
                  }
                  required
                />
              </label>
              <label className="field field-full">
                <span>备注</span>
                <textarea
                  rows={3}
                  value={allocationForm.note}
                  onChange={(event) =>
                    setAllocationForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="field-hint field-full">
                当前选择：{selectedReceipt?.materialName ?? '未选择到货批次'} →
                {selectedBatch ? ` ${selectedBatch.batchNo}` : ' 未选择生产批次'}
              </div>
              <div className="field-full">
                <button className="action-button" disabled={isPending} type="submit">
                  {isPending ? '保存中...' : '保存共用料分配'}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>

      <aside className="stack">
        <div className="panel list-card">
          <h2 className="section-title">待生产批次状态</h2>
          <div className="list">
            {data.pendingBatches.map((batch) => (
              <div className="list-item" key={batch.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <strong>{batch.batchNo}</strong>
                  <span className="muted">{batch.status}</span>
                </div>
                <div className="muted">
                  {batch.productName} · 计划 {batch.plannedQty} · 预计 {formatDate(batch.predictedLaunchDate)}
                </div>
                <div className="muted" style={{ marginTop: 6 }}>
                  {batch.blockingReason ?? '当前无受阻原因'}
                </div>
                <div className="list" style={{ marginTop: 10 }}>
                  {batch.sharedRequirements.map((item) => (
                    <div key={`${batch.id}-${item.materialId}`} className="subtle-box">
                      {item.materialName}：需 {item.requiredQty}，已分 {item.allocatedQty}，剩余 {item.remainingQty}
                    </div>
                  ))}
                </div>
                {isAdmin ? (
                  <div className="button-row">
                    <button
                      className="secondary-button"
                      disabled={isPending}
                      onClick={() => handleBatchStatusChange(batch.id, 'PENDING')}
                      type="button"
                    >
                      设为待生产
                    </button>
                    <button
                      className="secondary-button"
                      disabled={isPending}
                      onClick={() => handleBatchStatusChange(batch.id, 'PAUSED')}
                      type="button"
                    >
                      设为暂缓
                    </button>
                    <button
                      className="secondary-button"
                      disabled={isPending}
                      onClick={() => handleBatchStatusChange(batch.id, 'COMPLETED')}
                      type="button"
                    >
                      设为已完成
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="panel list-card">
          <h2 className="section-title">共用料余量</h2>
          <div className="list">
            {data.sharedReceiptBatches.map((receipt) => (
              <div className="list-item" key={receipt.id}>
                <strong>{receipt.batchNo}</strong>
                <div className="muted">
                  {receipt.materialName} · 到货 {receipt.arrivedQty} · 已分 {receipt.allocatedQty} · 余量 {receipt.remainingQty}
                </div>
                <div className="muted">到货时间：{formatDate(receipt.arrivedAt)}</div>
              </div>
            ))}
          </div>
        </div>

        {(message || error) && (
          <div className="panel list-card">
            <h2 className="section-title">最近操作</h2>
            {message ? <div className="success-text">{message}</div> : null}
            {error ? <div className="error-text">{error}</div> : null}
          </div>
        )}
      </aside>
    </div>
  );
}
