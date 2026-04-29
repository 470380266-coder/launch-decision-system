'use client';

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useState, useTransition } from 'react';
import {
  confirmProcurementArrival,
  createAllocation,
  createBomVersion,
  createProcurementTrack,
  getCurrentUser,
  getOperationsBootstrapAuthed,
  updateBatchActual,
  updateBatchStatus,
  updateProcurementTrack,
} from '@/lib/api';
import { AuthUser, OperationBootstrap } from '@/lib/types';

const TOKEN_KEY = 'launch-decision-token';

const errorMessages: Record<string, string> = {
  'Allocation exceeds remaining receipt quantity': '分配数量超过该到货批次的剩余数量',
  'Allocation exceeds the batch shared-material requirement':
    '分配数量超过当前批次的共用料缺口',
  'Receipt batch not found': '未找到到货批次',
  'Production batch not found': '未找到生产批次',
};

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

function toDateTimeLocal(input: string | null | undefined) {
  if (!input) {
    return '';
  }

  const date = new Date(input);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function roleName(role: AuthUser['role']) {
  if (role === 'ADMIN') {
    return '管理员';
  }
  if (role === 'PURCHASER') {
    return '采购';
  }
  return '运营查看';
}

const orderStatusLabels: Record<
  OperationBootstrap['procurementTracks'][number]['orderStatus'],
  string
> = {
  NOT_ORDERED: '未下单',
  ORDERED: '已下单',
  PARTIAL: '部分到货',
  COMPLETED: '已完成',
};

const productionStatusLabels: Record<
  OperationBootstrap['procurementTracks'][number]['productionStatus'],
  string
> = {
  NOT_STARTED: '未生产',
  IN_PRODUCTION: '生产中',
  READY_TO_SHIP: '待发货',
  SHIPPED: '已发货',
  ARRIVED: '已到货',
};

function procurementStatusClass(
  status: OperationBootstrap['procurementTracks'][number]['productionStatus'],
) {
  if (status === 'ARRIVED') {
    return 'status-launchable';
  }
  if (status === 'SHIPPED' || status === 'READY_TO_SHIP') {
    return 'status-schedulable';
  }
  return 'status-blocked';
}

function isTrackSharedMaterial(
  data: OperationBootstrap,
  track: OperationBootstrap['procurementTracks'][number],
) {
  return data.activeBoms.some(
    (bom) =>
      bom.productId === track.productId &&
      bom.items.some(
        (item) => item.materialId === track.materialId && item.isSharedMaterial,
      ),
  );
}

function friendlyError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return errorMessages[message] ?? message ?? fallback;
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
        setUser(currentUser);
        if (currentUser.role !== 'VIEWER') {
          setData(await getOperationsBootstrapAuthed(storedToken));
        }
      } catch {
        window.localStorage.removeItem(TOKEN_KEY);
        setError('登录已失效，请重新登录');
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  async function refreshData() {
    if (!token) {
      throw new Error('Missing auth token');
    }
    setData(await getOperationsBootstrapAuthed(token));
  }

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/login';
  }

  if (authLoading) {
    return <div className="panel list-card muted">正在校验登录状态...</div>;
  }

  if (!token || !user) {
    return (
      <div className="panel list-card">
        <p className="muted">你还没有登录，或登录状态已失效。</p>
        <Link href="/login" className="action-button" style={{ display: 'inline-flex' }}>
          去登录
        </Link>
      </div>
    );
  }

  if (user.role === 'VIEWER') {
    return (
      <div className="panel list-card">
        <p className="muted">当前账号仅可查看上架决策看板，无操作台权限。</p>
        <Link href="/" className="secondary-button" style={{ display: 'inline-flex' }}>
          返回看板
        </Link>
      </div>
    );
  }

  if (!data) {
    return <div className="panel list-card muted">正在加载工作台数据...</div>;
  }

  return (
    <div className="ops-console-layout">
      <section className="ops-main-column">
        <div className="ops-workbench-header">
          <div>
            <h1>
              {user.role === 'PURCHASER'
                ? '采购跟进子物料'
                : '管理员管理批次和单品'}
            </h1>
            <p className="muted">
              {user.role === 'PURCHASER'
                ? '按子物料维护下单、生产、发货、在途和到货确认。'
                : '按生产批次处理共用料、批次状态和实际结果，并在单品管理里维护 BOM。'}
            </p>
          </div>
        </div>

        {(message || error) && (
          <div className="ops-message-row">
            {message ? <div className="success-text">{message}</div> : null}
            {error ? <div className="error-text">{error}</div> : null}
          </div>
        )}

        {user.role === 'PURCHASER' ? (
          <ProcurementWorkspace
            data={data}
            isPending={isPending}
            onError={setError}
            onMessage={setMessage}
            onRefresh={refreshData}
            startTransition={startTransition}
            token={token}
          />
        ) : (
          <AdminWorkspace
            data={data}
            isPending={isPending}
            onError={setError}
            onMessage={setMessage}
            onRefresh={refreshData}
            startTransition={startTransition}
            token={token}
          />
        )}
      </section>

      <aside className="ops-side-column">
        <div className="ops-side-section">
          <div className="ops-account-card">
            <div>
              <div className="field-hint">当前登录</div>
              <strong>
                {user.name} · {roleName(user.role)}
              </strong>
              <div className="field-hint">{user.username}</div>
            </div>
            <button className="secondary-button" onClick={logout} type="button">
              退出
            </button>
          </div>
        </div>

        <SidePanel data={data} user={user} />
      </aside>
    </div>
  );
}

function SidePanel({
  data,
  user,
}: {
  data: OperationBootstrap;
  user: AuthUser;
}) {
  const sharedRemaining = data.sharedReceiptBatches.reduce(
    (sum, receipt) => sum + receipt.remainingQty,
    0,
  );
  const batchTodos = data.pendingBatches.filter((batch) =>
    batch.sharedRequirements.some((item) => item.isSharedMaterial && item.remainingQty > 0),
  );
  const procurementTodos = data.procurementTracks.filter(
    (track) => track.productionStatus !== 'ARRIVED',
  );

  return (
    <>
      <div className="ops-side-section">
        <h2 className="ops-side-title">待办事项</h2>
        <div className="list">
          {user.role === 'PURCHASER' ? (
            procurementTodos.length ? (
              procurementTodos.slice(0, 4).map((track) => (
                <div className="ops-side-item" key={track.id}>
                  <strong>{track.materialName}</strong>
                  <div className="muted">
                    {track.productName} · 下次跟进 {formatDate(track.nextFollowUpAt)}
                  </div>
                </div>
              ))
            ) : (
              <div className="muted">暂无采购待办</div>
            )
          ) : batchTodos.length ? (
            batchTodos.slice(0, 4).map((batch) => (
              <div className="ops-side-item" key={batch.id}>
                <strong>{batch.batchNo}</strong>
                <div className="muted">
                  共用料缺口{' '}
                  {batch.sharedRequirements
                    .filter((item) => item.isSharedMaterial)
                    .reduce((sum, item) => sum + item.remainingQty, 0)}
                </div>
              </div>
            ))
          ) : (
            <div className="muted">暂无批次待办</div>
          )}
        </div>
      </div>

      {user.role === 'ADMIN' ? (
        <div className="ops-side-section">
          <div className="ops-card-header" style={{ marginBottom: 12 }}>
            <h2 className="ops-side-title" style={{ margin: 0 }}>
              共用料池
            </h2>
            <span className="status-chip status-launchable">余量 {sharedRemaining}</span>
          </div>
          <div className="list">
            {data.sharedReceiptBatches.length ? (
              data.sharedReceiptBatches.map((receipt) => (
                <div className="ops-side-item" key={receipt.id}>
                  <strong>{receipt.batchNo}</strong>
                  <div className="muted">
                    {receipt.materialName} · 到货 {receipt.arrivedQty} · 已分{' '}
                    {receipt.allocatedQty} · 余量 {receipt.remainingQty}
                  </div>
                </div>
              ))
            ) : (
              <div className="muted">暂无共用料到货</div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

type WorkspaceProps = {
  data: OperationBootstrap;
  isPending: boolean;
  onError: (message: string | null) => void;
  onMessage: (message: string | null) => void;
  onRefresh: () => Promise<void>;
  startTransition: ReturnType<typeof useTransition>[1];
  token: string;
};

function ProcurementWorkspace({
  data,
  isPending,
  onError,
  onMessage,
  onRefresh,
  startTransition,
  token,
}: WorkspaceProps) {
  const [trackForm, setTrackForm] = useState({
    productId: data.products[0]?.id ?? '',
    materialId: data.materials[0]?.id ?? '',
    requiredQty: 1,
    orderedQty: 1,
    expectedShipAt: '',
    expectedArriveAt: '',
    nextFollowUpAt: '',
    todoNote: '',
    note: '',
  });
  const [editTrackId, setEditTrackId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    orderedQty: 0,
    orderStatus: 'ORDERED',
    productionStatus: 'IN_PRODUCTION',
    expectedShipAt: '',
    inTransitAt: '',
    expectedArriveAt: '',
    nextFollowUpAt: '',
    todoNote: '',
    note: '',
  });
  const [arrivalTrackId, setArrivalTrackId] = useState<string | null>(null);
  const [arrivalForm, setArrivalForm] = useState({
    receiptBatchNo: '',
    arrivedQty: 1,
    arrivedAt: new Date().toISOString().slice(0, 16),
    note: '',
  });
  const [filter, setFilter] = useState<
    'ALL' | 'TODO' | OperationBootstrap['procurementTracks'][number]['productionStatus']
  >('TODO');
  const [showCreateTrack, setShowCreateTrack] = useState(false);

  function openEdit(track: OperationBootstrap['procurementTracks'][number]) {
    setEditTrackId(track.id);
    setEditForm({
      orderedQty: track.orderedQty,
      orderStatus: track.orderStatus,
      productionStatus: track.productionStatus,
      expectedShipAt: toDateTimeLocal(track.expectedShipAt),
      inTransitAt: toDateTimeLocal(track.inTransitAt),
      expectedArriveAt: toDateTimeLocal(track.expectedArriveAt),
      nextFollowUpAt: toDateTimeLocal(track.nextFollowUpAt),
      todoNote: track.todoNote ?? '',
      note: track.note ?? '',
    });
  }

  function handleCreateTrack(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onMessage(null);
    onError(null);

    startTransition(async () => {
      try {
        await createProcurementTrack(
          {
            ...trackForm,
            requiredQty: Number(trackForm.requiredQty),
            orderedQty: Number(trackForm.orderedQty),
            expectedShipAt: trackForm.expectedShipAt || undefined,
            expectedArriveAt: trackForm.expectedArriveAt || undefined,
            nextFollowUpAt: trackForm.nextFollowUpAt || undefined,
            todoNote: trackForm.todoNote || undefined,
            note: trackForm.note || undefined,
          },
          token,
        );
        await onRefresh();
        onMessage('采购跟进已新增');
        setTrackForm((current) => ({
          ...current,
          requiredQty: 1,
          orderedQty: 1,
          todoNote: '',
          note: '',
        }));
      } catch (submissionError) {
        onError(submissionError instanceof Error ? submissionError.message : '新增失败');
      }
    });
  }

  function handleUpdateTrack(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTrackId) {
      return;
    }
    onMessage(null);
    onError(null);

    startTransition(async () => {
      try {
        await updateProcurementTrack(
          editTrackId,
          {
            orderedQty: Number(editForm.orderedQty),
            orderStatus: editForm.orderStatus as never,
            productionStatus: editForm.productionStatus as never,
            expectedShipAt: editForm.expectedShipAt || null,
            inTransitAt: editForm.inTransitAt || null,
            expectedArriveAt: editForm.expectedArriveAt || null,
            nextFollowUpAt: editForm.nextFollowUpAt || null,
            todoNote: editForm.todoNote || null,
            note: editForm.note || null,
          },
          token,
        );
        await onRefresh();
        onMessage('采购跟进已更新');
        setEditTrackId(null);
      } catch (submissionError) {
        onError(submissionError instanceof Error ? submissionError.message : '更新失败');
      }
    });
  }

  function handleConfirmArrival(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!arrivalTrackId) {
      return;
    }
    onMessage(null);
    onError(null);

    startTransition(async () => {
      try {
        await confirmProcurementArrival(
          arrivalTrackId,
          {
            ...arrivalForm,
            arrivedQty: Number(arrivalForm.arrivedQty),
            note: arrivalForm.note || undefined,
          },
          token,
        );
        await onRefresh();
        onMessage('到货已确认，并已生成到货批次');
        setArrivalTrackId(null);
        setArrivalForm({
          receiptBatchNo: '',
          arrivedQty: 1,
          arrivedAt: new Date().toISOString().slice(0, 16),
          note: '',
        });
      } catch (submissionError) {
        onError(submissionError instanceof Error ? submissionError.message : '确认到货失败');
      }
    });
  }

  const pendingTodos = data.procurementTracks.filter(
    (track) => track.productionStatus !== 'ARRIVED',
  );
  const filteredTracks = data.procurementTracks.filter((track) => {
    if (filter === 'ALL') {
      return true;
    }
    if (filter === 'TODO') {
      return track.productionStatus !== 'ARRIVED';
    }
    return track.productionStatus === filter;
  });

  return (
    <div className="ops-data-section">
      <div className="ops-table-toolbar">
        <div>
          <h2>子物料采购台账</h2>
          <p className="muted">
            一行一条采购跟进，先维护链路状态；到货后单独确认到货数量。
          </p>
        </div>
        <div className="toolbar-actions">
          <span className="metric-pill">待跟进 {pendingTodos.length}</span>
          <span className="metric-pill">
            已到货 {data.procurementTracks.length - pendingTodos.length}
          </span>
          <button
            className="action-button table-action"
            onClick={() => setShowCreateTrack((current) => !current)}
            type="button"
          >
            {showCreateTrack ? '收起新增' : '新增跟进'}
          </button>
        </div>
      </div>

      <div className="table-filter-row">
        {[
          ['TODO', '待跟进'],
          ['READY_TO_SHIP', '待发货'],
          ['SHIPPED', '在途'],
          ['ARRIVED', '已到货'],
          ['ALL', '全部'],
        ].map(([value, label]) => (
          <button
            className={filter === value ? 'active' : ''}
            key={value}
            onClick={() => setFilter(value as typeof filter)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {showCreateTrack ? (
        <form className="inline-create-form" onSubmit={handleCreateTrack}>
          <label className="field">
            <span>单品</span>
            <select
              value={trackForm.productId}
              onChange={(event) =>
                setTrackForm((current) => ({ ...current, productId: event.target.value }))
              }
            >
              {data.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.code} · {product.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>子物料</span>
            <select
              value={trackForm.materialId}
              onChange={(event) =>
                setTrackForm((current) => ({ ...current, materialId: event.target.value }))
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
            <span>需求数量</span>
            <input
              min={1}
              type="number"
              value={trackForm.requiredQty}
              onChange={(event) =>
                setTrackForm((current) => ({
                  ...current,
                  requiredQty: Number(event.target.value),
                }))
              }
            />
          </label>
          <label className="field">
            <span>下单数量</span>
            <input
              min={0}
              type="number"
              value={trackForm.orderedQty}
              onChange={(event) =>
                setTrackForm((current) => ({
                  ...current,
                  orderedQty: Number(event.target.value),
                }))
              }
            />
          </label>
          <label className="field">
            <span>预计发货</span>
            <input
              type="datetime-local"
              value={trackForm.expectedShipAt}
              onChange={(event) =>
                setTrackForm((current) => ({
                  ...current,
                  expectedShipAt: event.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span>预计到货</span>
            <input
              type="datetime-local"
              value={trackForm.expectedArriveAt}
              onChange={(event) =>
                setTrackForm((current) => ({
                  ...current,
                  expectedArriveAt: event.target.value,
                }))
              }
            />
          </label>
          <label className="field field-full">
            <span>待办提醒</span>
            <input
              value={trackForm.todoNote}
              onChange={(event) =>
                setTrackForm((current) => ({ ...current, todoNote: event.target.value }))
              }
            />
          </label>
          <div className="field-full button-row">
            <button className="action-button" disabled={isPending} type="submit">
              新增跟进
            </button>
            <button
              className="secondary-button"
              onClick={() => setShowCreateTrack(false)}
              type="button"
            >
              取消
            </button>
          </div>
        </form>
      ) : null}

      <table className="product-table batch-table procurement-table">
        <thead>
          <tr>
            <th>单品 / 子物料</th>
            <th>数量</th>
            <th>下单</th>
            <th>生产</th>
            <th>预计发货</th>
            <th>在途</th>
            <th>预计到货</th>
            <th>下次跟进</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {filteredTracks.length ? (
            filteredTracks.map((track) => (
              <Fragment key={track.id}>
                <tr
                  className={
                    editTrackId === track.id || arrivalTrackId === track.id
                      ? 'selected-table-row'
                      : ''
                  }
                >
                  <td>
                    <div className="material-title-line">
                      <strong>{track.materialName}</strong>
                      {isTrackSharedMaterial(data, track) ? (
                        <span className="mini-tag">共用料</span>
                      ) : null}
                    </div>
                    <div className="muted">
                      {track.materialCode} · {track.productName}
                    </div>
                    {track.todoNote ? <div className="row-note">{track.todoNote}</div> : null}
                  </td>
                  <td>
                    需求 {track.requiredQty}
                    <div className="muted">
                      下单 {track.orderedQty} · 到货 {track.arrivedQty}
                    </div>
                  </td>
                  <td>{orderStatusLabels[track.orderStatus]}</td>
                  <td>
                    <span
                      className={`status-chip ${procurementStatusClass(
                        track.productionStatus,
                      )}`}
                    >
                      {productionStatusLabels[track.productionStatus]}
                    </span>
                  </td>
                  <td>{formatDate(track.expectedShipAt)}</td>
                  <td>{formatDate(track.inTransitAt)}</td>
                  <td>{formatDate(track.expectedArriveAt)}</td>
                  <td>{formatDate(track.nextFollowUpAt)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="secondary-button table-action"
                        onClick={() => {
                          setArrivalTrackId(null);
                          openEdit(track);
                        }}
                        type="button"
                      >
                        编辑
                      </button>
                      <button
                        className="secondary-button table-action"
                        onClick={() => {
                          setEditTrackId(null);
                          setArrivalTrackId(track.id);
                          setArrivalForm((current) => ({
                            ...current,
                            receiptBatchNo:
                              track.receiptBatchNo ?? `RB-${track.materialCode}-${Date.now()}`,
                            arrivedQty: Math.max(track.requiredQty - track.arrivedQty, 1),
                          }));
                        }}
                        type="button"
                      >
                        到货
                      </button>
                    </div>
                  </td>
                </tr>

                {editTrackId === track.id ? (
                  <tr className="expanded-table-row">
                    <td colSpan={9}>
                      <form className="batch-edit-panel" onSubmit={handleUpdateTrack}>
                        <h3>编辑采购进度：{track.materialName}</h3>
                        <div className="inline-edit-grid">
                          <label className="field">
                            <span>下单状态</span>
                            <select
                              value={editForm.orderStatus}
                              onChange={(event) =>
                                setEditForm((current) => ({
                                  ...current,
                                  orderStatus: event.target.value,
                                }))
                              }
                            >
                              <option value="NOT_ORDERED">未下单</option>
                              <option value="ORDERED">已下单</option>
                              <option value="PARTIAL">部分到货</option>
                              <option value="COMPLETED">已完成</option>
                            </select>
                          </label>
                          <label className="field">
                            <span>生产状态</span>
                            <select
                              value={editForm.productionStatus}
                              onChange={(event) =>
                                setEditForm((current) => ({
                                  ...current,
                                  productionStatus: event.target.value,
                                }))
                              }
                            >
                              <option value="NOT_STARTED">未生产</option>
                              <option value="IN_PRODUCTION">生产中</option>
                              <option value="READY_TO_SHIP">待发货</option>
                              <option value="SHIPPED">已发货</option>
                              <option value="ARRIVED">已到货</option>
                            </select>
                          </label>
                          <label className="field">
                            <span>已下单数量</span>
                            <input
                              min={0}
                              type="number"
                              value={editForm.orderedQty}
                              onChange={(event) =>
                                setEditForm((current) => ({
                                  ...current,
                                  orderedQty: Number(event.target.value),
                                }))
                              }
                            />
                          </label>
                          <label className="field">
                            <span>预计发货</span>
                            <input
                              type="datetime-local"
                              value={editForm.expectedShipAt}
                              onChange={(event) =>
                                setEditForm((current) => ({
                                  ...current,
                                  expectedShipAt: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="field">
                            <span>在途时间</span>
                            <input
                              type="datetime-local"
                              value={editForm.inTransitAt}
                              onChange={(event) =>
                                setEditForm((current) => ({
                                  ...current,
                                  inTransitAt: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="field">
                            <span>预计到货</span>
                            <input
                              type="datetime-local"
                              value={editForm.expectedArriveAt}
                              onChange={(event) =>
                                setEditForm((current) => ({
                                  ...current,
                                  expectedArriveAt: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="field">
                            <span>下次跟进</span>
                            <input
                              type="datetime-local"
                              value={editForm.nextFollowUpAt}
                              onChange={(event) =>
                                setEditForm((current) => ({
                                  ...current,
                                  nextFollowUpAt: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="field field-full">
                            <span>待办提醒</span>
                            <input
                              value={editForm.todoNote}
                              onChange={(event) =>
                                setEditForm((current) => ({
                                  ...current,
                                  todoNote: event.target.value,
                                }))
                              }
                            />
                          </label>
                        </div>
                        <div className="button-row">
                          <button className="action-button" disabled={isPending} type="submit">
                            保存进度
                          </button>
                          <button
                            className="secondary-button"
                            onClick={() => setEditTrackId(null)}
                            type="button"
                          >
                            取消
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : null}

                {arrivalTrackId === track.id ? (
                  <tr className="expanded-table-row">
                    <td colSpan={9}>
                      <form className="batch-edit-panel" onSubmit={handleConfirmArrival}>
                        <h3>确认到货：{track.materialName}</h3>
                        <div className="inline-edit-grid">
                          <label className="field">
                            <span>到货批次号</span>
                            <input
                              value={arrivalForm.receiptBatchNo}
                              onChange={(event) =>
                                setArrivalForm((current) => ({
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
                              value={arrivalForm.arrivedQty}
                              onChange={(event) =>
                                setArrivalForm((current) => ({
                                  ...current,
                                  arrivedQty: Number(event.target.value),
                                }))
                              }
                            />
                          </label>
                          <label className="field">
                            <span>到货时间</span>
                            <input
                              type="datetime-local"
                              value={arrivalForm.arrivedAt}
                              onChange={(event) =>
                                setArrivalForm((current) => ({
                                  ...current,
                                  arrivedAt: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="field field-full">
                            <span>备注</span>
                            <input
                              value={arrivalForm.note}
                              onChange={(event) =>
                                setArrivalForm((current) => ({
                                  ...current,
                                  note: event.target.value,
                                }))
                              }
                            />
                          </label>
                        </div>
                        <div className="button-row">
                          <button className="action-button" disabled={isPending} type="submit">
                            确认到货
                          </button>
                          <button
                            className="secondary-button"
                            onClick={() => setArrivalTrackId(null)}
                            type="button"
                          >
                            取消
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))
          ) : (
            <tr>
              <td className="muted" colSpan={9}>
                当前筛选下暂无采购跟进记录。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AdminWorkspace(props: WorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'batches' | 'products'>('batches');

  return (
    <div className="ops-module">
      <div className="ops-module-tabs">
        <button
          className={activeTab === 'batches' ? 'active' : ''}
          onClick={() => setActiveTab('batches')}
          type="button"
        >
          批次工作台
        </button>
        <button
          className={activeTab === 'products' ? 'active' : ''}
          onClick={() => setActiveTab('products')}
          type="button"
        >
          单品管理
        </button>
      </div>
      {activeTab === 'batches' ? <BatchWorkspace {...props} /> : <ProductWorkspace {...props} />}
    </div>
  );
}

function BatchWorkspace({
  data,
  isPending,
  onError,
  onMessage,
  onRefresh,
  startTransition,
  token,
}: WorkspaceProps) {
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(
    data.pendingBatches[0]?.id ?? null,
  );
  const [allocationByBatch, setAllocationByBatch] = useState<
    Record<string, { receiptBatchId: string; allocatedQty: number; note: string }>
  >({});
  const [actualByBatch, setActualByBatch] = useState<
    Record<
      string,
      {
        actualStartAt: string;
        actualFinishAt: string;
        actualLaunchAt: string;
        actualLaunchQty: string;
      }
    >
  >({});

  function allocationDraft(
    batchId: string,
    materialId: string,
    remainingQty: number,
  ) {
    const receipt =
      data.sharedReceiptBatches.find(
        (item) => item.materialId === materialId && item.remainingQty > 0,
      ) ?? null;
    const maxQty = Math.max(Math.min(remainingQty, receipt?.remainingQty ?? remainingQty), 0);

    return (
      allocationByBatch[batchId] ?? {
        receiptBatchId: receipt?.id ?? '',
        allocatedQty: maxQty > 0 ? maxQty : 1,
        note: '',
      }
    );
  }

  function actualDraft(batch: OperationBootstrap['pendingBatches'][number]) {
    return (
      actualByBatch[batch.id] ?? {
        actualStartAt: toDateTimeLocal(batch.actual?.startAt),
        actualFinishAt: toDateTimeLocal(batch.actual?.finishAt),
        actualLaunchAt: toDateTimeLocal(batch.actual?.launchAt),
        actualLaunchQty:
          batch.actual?.launchQty === null || batch.actual?.launchQty === undefined
            ? ''
            : String(batch.actual.launchQty),
      }
    );
  }

  function saveAllocation(
    batchId: string,
    materialId: string,
    remainingQty: number,
  ) {
    const draft = allocationDraft(batchId, materialId, remainingQty);
    const selectedReceipt = data.sharedReceiptBatches.find(
      (receipt) => receipt.id === draft.receiptBatchId,
    );
    const maxQty = Math.min(remainingQty, selectedReceipt?.remainingQty ?? 0);
    onMessage(null);
    onError(null);

    if (Number(draft.allocatedQty) > maxQty) {
      onError(`最多只能分配 ${maxQty}，已按当前批次缺口和到货余量计算`);
      return;
    }

    startTransition(async () => {
      try {
        await createAllocation(
          {
            productionBatchId: batchId,
            receiptBatchId: draft.receiptBatchId,
            allocatedQty: Number(draft.allocatedQty),
            note: draft.note || undefined,
          },
          token,
        );
        await onRefresh();
        onMessage('共用料分配已保存');
      } catch (submissionError) {
        onError(friendlyError(submissionError, '共用料分配失败'));
      }
    });
  }

  function saveActual(batch: OperationBootstrap['pendingBatches'][number]) {
    const draft = actualDraft(batch);
    onMessage(null);
    onError(null);

    startTransition(async () => {
      try {
        await updateBatchActual(
          batch.id,
          {
            actualStartAt: draft.actualStartAt || null,
            actualFinishAt: draft.actualFinishAt || null,
            actualLaunchAt: draft.actualLaunchAt || null,
            actualLaunchQty: draft.actualLaunchQty ? Number(draft.actualLaunchQty) : null,
          },
          token,
        );
        await onRefresh();
        onMessage('实际结果已回填');
      } catch (submissionError) {
        onError(submissionError instanceof Error ? submissionError.message : '实际结果回填失败');
      }
    });
  }

  function changeStatus(batchId: string, status: 'PENDING' | 'PAUSED' | 'COMPLETED') {
    onMessage(null);
    onError(null);
    startTransition(async () => {
      try {
        await updateBatchStatus(batchId, { batchStatus: status }, token);
        await onRefresh();
        onMessage('批次状态已更新');
      } catch (submissionError) {
        onError(submissionError instanceof Error ? submissionError.message : '批次状态更新失败');
      }
    });
  }

  return (
    <div>
      <section className="ops-data-section">
        <div className="ops-table-toolbar">
          <div>
            <h2>批次列表</h2>
            <div className="muted">点击“编辑”展开单个批次处理共用料、状态和实际结果。</div>
          </div>
          <div className="field-hint">共 {data.pendingBatches.length} 个待处理批次</div>
        </div>

        <table className="product-table batch-table">
          <thead>
            <tr>
              <th>批次</th>
              <th>状态</th>
              <th>计划量</th>
              <th>预计上架</th>
              <th>共用料缺口</th>
              <th>关键原因</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {data.pendingBatches.map((batch) => {
              const actual = actualDraft(batch);
              const sharedGap = batch.sharedRequirements
                .filter((item) => item.isSharedMaterial)
                .reduce((sum, item) => sum + item.remainingQty, 0);
              const isExpanded = expandedBatchId === batch.id;

              return (
                <Fragment key={batch.id}>
                  <tr
                    className={isExpanded ? 'selected-table-row' : undefined}
                  >
                    <td>
                      <strong>{batch.batchNo}</strong>
                      <div className="muted">{batch.productName}</div>
                    </td>
                    <td>
                      <span className="status-chip status-schedulable">{batch.status}</span>
                    </td>
                    <td>{batch.plannedQty}</td>
                    <td>{formatDate(batch.predictedLaunchDate)}</td>
                    <td>{sharedGap}</td>
                    <td className="muted">{batch.blockingReason ?? '无'}</td>
                    <td>
                      <button
                        className="secondary-button table-action"
                        onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                        type="button"
                      >
                        {isExpanded ? '收起' : '编辑'}
                      </button>
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className="expanded-table-row" key={`${batch.id}-edit`}>
                      <td colSpan={7}>
                        <div className="batch-edit-panel">
                          <section>
                            <h3>子物料与共用料分配</h3>
                            <div className="list">
                              {batch.sharedRequirements.map((item) => {
                                const draft = allocationDraft(
                                  batch.id,
                                  item.materialId,
                                  item.remainingQty,
                                );
                                const receipts = data.sharedReceiptBatches.filter(
                                  (receipt) => receipt.materialId === item.materialId,
                                );
                                const selectedReceipt = receipts.find(
                                  (receipt) => receipt.id === draft.receiptBatchId,
                                );
                                const maxAllocQty = Math.min(
                                  item.remainingQty,
                                  selectedReceipt?.remainingQty ?? 0,
                                );

                                return (
                                  <div
                                    className="subtle-box batch-material-row"
                                    key={item.materialId}
                                  >
                                    <div>
                                      <strong>{item.materialName}</strong>
                                      <div className="muted">
                                        需求 {item.requiredQty}
                                        {item.isSharedMaterial
                                          ? ` · 已分 ${item.allocatedQty} · 缺口 ${item.remainingQty}`
                                          : ' · 非共用料，由采购到货链接'}
                                      </div>
                                    </div>
                                    {item.isSharedMaterial ? (
                                      <div className="inline-form">
                                        <select
                                          value={draft.receiptBatchId}
                                          onChange={(event) =>
                                            setAllocationByBatch((current) => ({
                                              ...current,
                                              [batch.id]: {
                                                ...draft,
                                                receiptBatchId: event.target.value,
                                                allocatedQty: Math.max(
                                                  Math.min(
                                                    item.remainingQty,
                                                    receipts.find(
                                                      (receipt) =>
                                                        receipt.id === event.target.value,
                                                    )?.remainingQty ?? 0,
                                                  ),
                                                  1,
                                                ),
                                              },
                                            }))
                                          }
                                        >
                                          <option value="">选择共用料批次</option>
                                          {receipts.map((receipt) => (
                                            <option key={receipt.id} value={receipt.id}>
                                              {receipt.batchNo} · 余量 {receipt.remainingQty}
                                            </option>
                                          ))}
                                        </select>
                                        <input
                                          min={1}
                                          max={maxAllocQty || 1}
                                          type="number"
                                          value={draft.allocatedQty}
                                          onChange={(event) =>
                                            setAllocationByBatch((current) => ({
                                              ...current,
                                              [batch.id]: {
                                                ...draft,
                                                allocatedQty: Math.min(
                                                  Number(event.target.value),
                                                  maxAllocQty || Number(event.target.value),
                                                ),
                                              },
                                            }))
                                          }
                                        />
                                        <button
                                          className="secondary-button"
                                          disabled={
                                            isPending ||
                                            !draft.receiptBatchId ||
                                            item.remainingQty <= 0 ||
                                            maxAllocQty <= 0
                                          }
                                          onClick={() =>
                                            saveAllocation(
                                              batch.id,
                                              item.materialId,
                                              item.remainingQty,
                                            )
                                          }
                                          type="button"
                                        >
                                          分配
                                        </button>
                                        <div className="field-hint inline-hint">
                                          最多 {maxAllocQty}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </section>

                          <section>
                            <h3>批次状态</h3>
                            <div className="button-row">
                              <button
                                className="secondary-button"
                                disabled={isPending}
                                onClick={() => changeStatus(batch.id, 'PENDING')}
                                type="button"
                              >
                                待生产
                              </button>
                              <button
                                className="secondary-button"
                                disabled={isPending}
                                onClick={() => changeStatus(batch.id, 'PAUSED')}
                                type="button"
                              >
                                暂缓
                              </button>
                              <button
                                className="secondary-button"
                                disabled={isPending}
                                onClick={() => changeStatus(batch.id, 'COMPLETED')}
                                type="button"
                              >
                                已完成
                              </button>
                            </div>
                          </section>

                          <section>
                            <h3>实际结果回填</h3>
                            <div className="form-grid">
                              <label className="field">
                                <span>实际开工</span>
                                <input
                                  type="datetime-local"
                                  value={actual.actualStartAt}
                                  onChange={(event) =>
                                    setActualByBatch((current) => ({
                                      ...current,
                                      [batch.id]: {
                                        ...actual,
                                        actualStartAt: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </label>
                              <label className="field">
                                <span>实际完成</span>
                                <input
                                  type="datetime-local"
                                  value={actual.actualFinishAt}
                                  onChange={(event) =>
                                    setActualByBatch((current) => ({
                                      ...current,
                                      [batch.id]: {
                                        ...actual,
                                        actualFinishAt: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </label>
                              <label className="field">
                                <span>实际上架</span>
                                <input
                                  type="datetime-local"
                                  value={actual.actualLaunchAt}
                                  onChange={(event) =>
                                    setActualByBatch((current) => ({
                                      ...current,
                                      [batch.id]: {
                                        ...actual,
                                        actualLaunchAt: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </label>
                              <label className="field">
                                <span>实际上架数量</span>
                                <input
                                  min={0}
                                  type="number"
                                  value={actual.actualLaunchQty}
                                  onChange={(event) =>
                                    setActualByBatch((current) => ({
                                      ...current,
                                      [batch.id]: {
                                        ...actual,
                                        actualLaunchQty: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </label>
                            </div>
                            <button
                              className="action-button"
                              disabled={isPending}
                              onClick={() => saveActual(batch)}
                              type="button"
                            >
                              保存实际结果
                            </button>
                          </section>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </section>

    </div>
  );
}

function ProductWorkspace({
  data,
  isPending,
  onError,
  onMessage,
  onRefresh,
  startTransition,
  token,
}: WorkspaceProps) {
  const [selectedProductId, setSelectedProductId] = useState(data.products[0]?.id ?? '');
  const [bomForm, setBomForm] = useState({
    productId: data.products[0]?.id ?? '',
    versionNo: '',
    effectiveFrom: new Date().toISOString().slice(0, 16),
    remark: '',
    activate: true,
    items: [
      {
        materialId: data.materials[0]?.id ?? '',
        unitUsage: 1,
        isSharedMaterial: false,
      },
    ],
  });
  const selectedBom = data.activeBoms.find((bom) => bom.productId === selectedProductId);

  function updateBomItem(
    index: number,
    patch: Partial<{ materialId: string; unitUsage: number; isSharedMaterial: boolean }>,
  ) {
    setBomForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  function handleBomSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onMessage(null);
    onError(null);

    startTransition(async () => {
      try {
        await createBomVersion(
          {
            ...bomForm,
            productId: selectedProductId,
            remark: bomForm.remark || undefined,
            items: bomForm.items.map((item) => ({
              ...item,
              unitUsage: Number(item.unitUsage),
            })),
          },
          token,
        );
        await onRefresh();
        onMessage('BOM 版本已保存');
        setBomForm((current) => ({
          ...current,
          versionNo: '',
          remark: '',
        }));
      } catch (submissionError) {
        onError(submissionError instanceof Error ? submissionError.message : 'BOM 保存失败');
      }
    });
  }

  return (
    <div className="workspace-grid">
      <section className="panel list-card">
        <h2 className="section-title">单品列表</h2>
        <div className="list">
          {data.products.map((product) => (
            <button
              className={`list-item selectable-row ${
                selectedProductId === product.id ? 'selected-row' : ''
              }`}
              key={product.id}
              onClick={() => {
                setSelectedProductId(product.id);
                setBomForm((current) => ({ ...current, productId: product.id }));
              }}
              type="button"
            >
              <strong>{product.name}</strong>
              <div className="muted">{product.code}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="stack">
        <div className="panel list-card">
          <h2 className="section-title">当前生效 BOM</h2>
          {selectedBom ? (
            <div className="list">
              <strong>{selectedBom.versionNo}</strong>
              <div className="muted">生效时间：{formatDate(selectedBom.effectiveFrom)}</div>
              {selectedBom.items.map((item) => (
                <div className="subtle-box" key={item.id}>
                  {item.materialName} · 单耗 {item.unitUsage} ·{' '}
                  {item.isSharedMaterial ? '共用料' : '非共用料'}
                </div>
              ))}
            </div>
          ) : (
            <div className="muted">当前单品暂无生效 BOM</div>
          )}
        </div>

        <div className="panel list-card">
          <h2 className="section-title">新增 BOM 版本</h2>
          <form className="form-grid" onSubmit={handleBomSubmit}>
            <label className="field">
              <span>BOM 版本号</span>
              <input
                value={bomForm.versionNo}
                onChange={(event) =>
                  setBomForm((current) => ({ ...current, versionNo: event.target.value }))
                }
                placeholder="BOM-V2"
                required
              />
            </label>
            <label className="field">
              <span>生效时间</span>
              <input
                type="datetime-local"
                value={bomForm.effectiveFrom}
                onChange={(event) =>
                  setBomForm((current) => ({ ...current, effectiveFrom: event.target.value }))
                }
                required
              />
            </label>
            <label className="field field-full">
              <span>备注</span>
              <textarea
                rows={2}
                value={bomForm.remark}
                onChange={(event) =>
                  setBomForm((current) => ({ ...current, remark: event.target.value }))
                }
              />
            </label>
            <div className="field-full list">
              {bomForm.items.map((item, index) => (
                <div className="subtle-box bom-item-row" key={`${index}-${item.materialId}`}>
                  <label className="field">
                    <span>子料</span>
                    <select
                      value={item.materialId}
                      onChange={(event) =>
                        updateBomItem(index, { materialId: event.target.value })
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
                    <span>单耗</span>
                    <input
                      min={1}
                      type="number"
                      value={item.unitUsage}
                      onChange={(event) =>
                        updateBomItem(index, { unitUsage: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>用料类型</span>
                    <select
                      value={item.isSharedMaterial ? 'shared' : 'dedicated'}
                      onChange={(event) =>
                        updateBomItem(index, {
                          isSharedMaterial: event.target.value === 'shared',
                        })
                      }
                    >
                      <option value="dedicated">非共用料</option>
                      <option value="shared">共用料</option>
                    </select>
                  </label>
                  <button
                    className="secondary-button"
                    disabled={bomForm.items.length <= 1}
                    onClick={() =>
                      setBomForm((current) => ({
                        ...current,
                        items: current.items.filter((_, itemIndex) => itemIndex !== index),
                      }))
                    }
                    type="button"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
            <div className="button-row field-full">
              <button
                className="secondary-button"
                onClick={() =>
                  setBomForm((current) => ({
                    ...current,
                    items: [
                      ...current.items,
                      {
                        materialId: data.materials[0]?.id ?? '',
                        unitUsage: 1,
                        isSharedMaterial: false,
                      },
                    ],
                  }))
                }
                type="button"
              >
                新增子料
              </button>
              <button className="action-button" disabled={isPending} type="submit">
                保存 BOM
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
