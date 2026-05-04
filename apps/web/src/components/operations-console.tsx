'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  activateBomVersion,
  confirmProcurementArrival,
  createAllocation,
  createBomVersion,
  createMaterial,
  createProduct,
  createStockingRequest,
  getCurrentUser,
  getOperationsBootstrapAuthed,
  updateBatchActual,
  updateBatchStatus,
  updateProcurementTrack,
} from '@/lib/api';
import { AuthUser, OperationBootstrap } from '@/lib/types';
import { PageTransition } from '@/components/page-transition';
import { FormField, Modal, inputCls, selectCls } from '@/components/modal';
import { AppButton } from '@/components/app-button';

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

function formatDemandQty(value: number) {
  if (!Number.isFinite(value)) {
    return '0';
  }

  return Number(value.toFixed(6)).toString();
}

function roleName(role: AuthUser['role']) {
  if (role === 'ADMIN') {
    return '管理员';
  }
  if (role === 'PURCHASER') {
    return '采购员';
  }
  return '运营';
}

function roleViewLabel(role: AuthUser['role']) {
  if (role === 'ADMIN') {
    return '批次工作台';
  }
  if (role === 'PURCHASER') {
    return '采购工作台';
  }
  return '上架决策看板';
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

function purchaseStatusLabel(track: OperationBootstrap['procurementTracks'][number]) {
  if (track.productionStatus === 'ARRIVED') {
    return '全部到货';
  }
  if (track.arrivedQty > 0) {
    return '部分到货';
  }
  if (track.orderStatus === 'NOT_ORDERED' || track.productionStatus === 'NOT_STARTED') {
    return '缺货';
  }
  if (track.orderStatus === 'ORDERED' || track.orderStatus === 'COMPLETED') {
    return '已下单';
  }
  return productionStatusLabels[track.productionStatus];
}

function purchaseDeltaText(track: OperationBootstrap['procurementTracks'][number]) {
  if (!track.expectedArriveAt || !track.actualArriveAt) {
    return '待确认';
  }

  const expected = new Date(track.expectedArriveAt).getTime();
  const actual = new Date(track.actualArriveAt).getTime();
  const diffDays = Math.ceil((actual - expected) / 86_400_000);

  if (diffDays > 0) {
    return `延期 ${diffDays} 天`;
  }
  return `提前 ${Math.abs(diffDays)} 天`;
}

function shortDate(input: string | null) {
  if (!input) {
    return '待确认';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(input));
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
    return (
      <main className="ops-page">
        <div className="ops-auth-card">正在校验登录状态...</div>
      </main>
    );
  }

  if (!token || !user) {
    return (
      <main className="ops-page">
      <div className="ops-auth-card">
        <p className="muted">你还没有登录，或登录状态已失效。</p>
        <Link href="/login" className="ops-primary-button">
          去登录
        </Link>
      </div>
      </main>
    );
  }

  if (user.role === 'VIEWER') {
    return (
      <main className="ops-page">
      <div className="ops-auth-card">
        <p className="muted">当前账号仅可查看上架决策看板，无操作台权限。</p>
        <Link href="/" className="ops-secondary-button">
          返回看板
        </Link>
      </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="ops-page">
        <div className="ops-auth-card">正在加载工作台数据...</div>
      </main>
    );
  }

  return (
    <main className="ops-page">
      <header className="home-topbar">
        <div className="home-topbar-inner">
          <div className="home-brand">
            <span className="home-brand-mark">备</span>
            <span>直播间备货系统</span>
            <span className="home-breadcrumb-separator">/</span>
            <span className="home-breadcrumb-current">{roleViewLabel(user.role)}</span>
          </div>
          <div className="home-account-panel">
            <span className="home-role-badge">{roleName(user.role)}</span>
            <span className="home-username">{user.username}</span>
            <button className="home-logout-button" onClick={logout} type="button">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M10 6H6v12h4" />
                <path d="M14 8l4 4-4 4" />
                <path d="M8 12h10" />
              </svg>
              退出
            </button>
          </div>
        </div>
      </header>

      <div className="ops-page-content">
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
      </div>
    </main>
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
    'ALL' | 'TODO' | 'ORDERED' | 'PARTIAL' | 'ARRIVED' | 'SHORT'
  >('ALL');
  const [search, setSearch] = useState('');

  function openEdit(track: OperationBootstrap['procurementTracks'][number]) {
    setEditTrackId(track.id);
    setArrivalTrackId(track.id);
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
    setArrivalForm({
      receiptBatchNo: track.receiptBatchNo ?? `RB-${track.materialCode}-${Date.now()}`,
      arrivedQty: Math.max(track.orderedQty - track.arrivedQty, 1),
      arrivedAt: toDateTimeLocal(track.actualArriveAt) || new Date().toISOString().slice(0, 16),
      note: '',
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
  const orderedCount = data.procurementTracks.filter(
    (track) => track.orderStatus === 'ORDERED' || track.orderStatus === 'COMPLETED',
  ).length;
  const filteredTracks = data.procurementTracks.filter((track) => {
    const normalizedSearch = search.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      [
        track.productName,
        track.productCode,
        track.materialName,
        track.materialCode,
        track.supplier ?? '',
        track.purchaseOrderNo ?? '',
        track.purchaserName,
        track.receiptBatchNo ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);

    if (!matchesSearch) {
      return false;
    }

    if (filter === 'ALL') {
      return true;
    }
    if (filter === 'TODO') {
      return track.productionStatus !== 'ARRIVED';
    }
    if (filter === 'ORDERED') {
      return track.orderStatus === 'ORDERED' || track.orderStatus === 'COMPLETED';
    }
    if (filter === 'PARTIAL') {
      return track.arrivedQty > 0 && track.productionStatus !== 'ARRIVED';
    }
    if (filter === 'ARRIVED') {
      return track.productionStatus === 'ARRIVED';
    }
    return track.orderStatus === 'NOT_ORDERED' || track.productionStatus === 'NOT_STARTED';
  });
  const selectedTrack = data.procurementTracks.find((track) => track.id === editTrackId);

  if (selectedTrack) {
    return (
      <PageTransition k={`purchase-edit-${selectedTrack.id}`}>
        <PurchaseEditView
          arrivalForm={arrivalForm}
          editForm={editForm}
          isPending={isPending}
          onArrivalChange={setArrivalForm}
          onBack={() => {
            setEditTrackId(null);
            setArrivalTrackId(null);
          }}
          onConfirmArrival={handleConfirmArrival}
          onEditChange={setEditForm}
          onSave={handleUpdateTrack}
          track={selectedTrack}
        />
      </PageTransition>
    );
  }

  return (
    <PageTransition k="purchase-list">
      <div className="purchase-workspace">
        <div className="purchase-breadcrumb">
          <span>角色工作台</span>
          <span>›</span>
          <strong>子物料采购台账</strong>
        </div>

        <section className="purchase-card">
          <div className="purchase-toolbar">
            <div className="purchase-toolbar-top">
              <label className="purchase-search">
                <span aria-hidden="true">⌕</span>
                <input
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="单品 / 子物料 / 供应商 / 采购单号"
                  value={search}
                />
              </label>
            </div>

            <div className="purchase-filter-row">
              {[
                { id: 'ALL', label: '全部' },
                { id: 'TODO', label: '待跟进', count: pendingTodos.length },
                { id: 'ORDERED', label: '已下单', count: orderedCount },
                { id: 'PARTIAL', label: '部分到货' },
                { id: 'ARRIVED', label: '全部到货' },
                { id: 'SHORT', label: '缺货' },
              ].map((item) => (
                <button
                  className={filter === item.id ? 'active' : ''}
                  key={item.id}
                  onClick={() => setFilter(item.id as typeof filter)}
                  type="button"
                >
                  {item.label}
                  {'count' in item && item.count != null ? (
                    <span>{item.count}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="purchase-table-scroll">
            <table className="purchase-table">
              <thead>
                <tr>
                  <th>单品 / 子物料</th>
                  <th>供应商 / 采购单</th>
                  <th>数量</th>
                  <th>状态</th>
                  <th>下单时间</th>
                  <th>预计到货</th>
                  <th>实际到货</th>
                  <th>差值</th>
                  <th>关联编号</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredTracks.length ? (
                  filteredTracks.map((track) => {
                    const delta = purchaseDeltaText(track);
                    const statusLabel = purchaseStatusLabel(track);
                    return (
                      <tr key={track.id}>
                        <td>
                          <strong>{track.materialName}</strong>
                          <div>{track.materialCode}</div>
                        </td>
                        <td>
                          <strong>{track.supplier ?? track.purchaserName}</strong>
                          <div>
                            {track.purchaseOrderNo ??
                              track.receiptBatchNo ??
                              `PO-${track.materialCode}`}
                          </div>
                        </td>
                        <td>
                          {formatDemandQty(track.orderedQty || track.requiredQty)}{' '}
                          {track.materialUnit ?? 'pcs'}
                        </td>
                        <td>
                          <span
                            className={`purchase-status ${
                              statusLabel === '全部到货'
                                ? 'purchase-status-arrived'
                                : statusLabel === '缺货'
                                  ? 'purchase-status-short'
                                  : ''
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td>{formatDate(track.orderedAt ?? track.expectedShipAt)}</td>
                        <td>{formatDate(track.expectedArriveAt)}</td>
                        <td>{shortDate(track.actualArriveAt)}</td>
                        <td
                          className={
                            delta.startsWith('延期')
                              ? 'purchase-delay'
                              : delta.startsWith('提前')
                                ? 'purchase-early'
                                : 'purchase-muted'
                          }
                        >
                          {delta}
                        </td>
                        <td>{track.stockingRequestNo ?? track.receiptBatchNo ?? '-'}</td>
                        <td>
                          <button onClick={() => openEdit(track)} type="button">
                            编辑
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="purchase-empty" colSpan={10}>
                      当前筛选下暂无采购跟进记录。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}

function PurchaseEditView({
  arrivalForm,
  editForm,
  isPending,
  onArrivalChange,
  onBack,
  onConfirmArrival,
  onEditChange,
  onSave,
  track,
}: {
  arrivalForm: {
    receiptBatchNo: string;
    arrivedQty: number;
    arrivedAt: string;
    note: string;
  };
  editForm: {
    orderedQty: number;
    orderStatus: string;
    productionStatus: string;
    expectedShipAt: string;
    inTransitAt: string;
    expectedArriveAt: string;
    nextFollowUpAt: string;
    todoNote: string;
    note: string;
  };
  isPending: boolean;
  onArrivalChange: React.Dispatch<
    React.SetStateAction<{
      receiptBatchNo: string;
      arrivedQty: number;
      arrivedAt: string;
      note: string;
    }>
  >;
  onBack: () => void;
  onConfirmArrival: (event: React.FormEvent<HTMLFormElement>) => void;
  onEditChange: React.Dispatch<
    React.SetStateAction<{
      orderedQty: number;
      orderStatus: string;
      productionStatus: string;
      expectedShipAt: string;
      inTransitAt: string;
      expectedArriveAt: string;
      nextFollowUpAt: string;
      todoNote: string;
      note: string;
    }>
  >;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
  track: OperationBootstrap['procurementTracks'][number];
}) {
  const inboundRows =
    track.arrivedQty > 0
      ? [
          {
            code: track.receiptBatchNo ?? '-',
            note: track.note || '无',
            qty: `${track.arrivedQty} pcs`,
            source: 'PURCHASE',
            time: formatDate(track.actualArriveAt),
          },
        ]
      : [];
  const remainingQty = Math.max(track.orderedQty - track.arrivedQty, 1);

  return (
    <div className="purchase-edit-view">
      <div className="purchase-edit-topline">
        <button className="purchase-back-button" onClick={onBack} type="button">
          ← 返回采购列表
        </button>
        <div className="purchase-breadcrumb">
          <span>角色工作台</span>
          <span>/</span>
          <span>子物料采购台账</span>
          <span>/</span>
          <strong>{track.materialName}</strong>
        </div>
      </div>

      <form
        className="purchase-edit-card"
        id="purchase-edit-form"
        onSubmit={onSave}
      >
        <div>
          <h2>编辑采购进度：{track.materialName}</h2>
          <p>
            {track.materialCode} · {track.supplier ?? track.purchaserName} · {track.productName}
          </p>
        </div>

        <div className="purchase-edit-grid">
          <PurchaseField label="供应商">
            <input disabled value={track.supplier ?? track.purchaserName} />
          </PurchaseField>
          <PurchaseField label="采购单号">
            <input
              disabled
              value={track.purchaseOrderNo ?? track.receiptBatchNo ?? `PO-${track.materialCode}`}
            />
          </PurchaseField>
          <PurchaseField label="下单状态" hint="已有入库记录,按累计入库数量自动判断">
            <select
              value={editForm.orderStatus}
              onChange={(event) =>
                onEditChange((current) => ({ ...current, orderStatus: event.target.value }))
              }
            >
              <option value="NOT_ORDERED">待下单</option>
              <option value="ORDERED">已下单</option>
              <option value="PARTIAL">部分到货</option>
              <option value="COMPLETED">已完成</option>
            </select>
          </PurchaseField>
          <PurchaseField label="生产状态" hint="累计入库达到下单数量后可切换为已到货">
            <select
              value={editForm.productionStatus}
              onChange={(event) =>
                onEditChange((current) => ({
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
          </PurchaseField>

          <PurchaseField label="已下单数量">
            <input
              min={0}
              step="any"
              type="number"
              value={editForm.orderedQty}
              onChange={(event) =>
                onEditChange((current) => ({
                  ...current,
                  orderedQty: Number(event.target.value),
                }))
              }
            />
          </PurchaseField>
          <PurchaseField label="下单时间">
            <input disabled value={formatDate(track.orderedAt ?? track.expectedShipAt)} />
          </PurchaseField>
          <PurchaseField label="预计发货">
            <input
              type="datetime-local"
              value={editForm.expectedShipAt}
              onChange={(event) =>
                onEditChange((current) => ({
                  ...current,
                  expectedShipAt: event.target.value,
                }))
              }
            />
          </PurchaseField>
          <PurchaseField label="在途时间">
            <input
              type="datetime-local"
              value={editForm.inTransitAt}
              onChange={(event) =>
                onEditChange((current) => ({ ...current, inTransitAt: event.target.value }))
              }
            />
          </PurchaseField>

          <PurchaseField label="在途天数">
            <input disabled value={track.inTransitAt && track.expectedArriveAt ? '2' : '待确认'} />
          </PurchaseField>
          <PurchaseField label="预计到货">
            <input
              type="datetime-local"
              value={editForm.expectedArriveAt}
              onChange={(event) =>
                onEditChange((current) => ({
                  ...current,
                  expectedArriveAt: event.target.value,
                }))
              }
            />
          </PurchaseField>
          <PurchaseField label="下次跟进">
            <input
              type="datetime-local"
              value={editForm.nextFollowUpAt}
              onChange={(event) =>
                onEditChange((current) => ({
                  ...current,
                  nextFollowUpAt: event.target.value,
                }))
              }
            />
          </PurchaseField>
          <div />
        </div>

        <PurchaseField label="异常备注说明">
          <textarea
            rows={3}
            value={editForm.note}
            onChange={(event) =>
              onEditChange((current) => ({ ...current, note: event.target.value }))
            }
          />
        </PurchaseField>
        <PurchaseField label="待办提醒">
          <textarea
            rows={3}
            value={editForm.todoNote}
            onChange={(event) =>
              onEditChange((current) => ({ ...current, todoNote: event.target.value }))
            }
          />
        </PurchaseField>
      </form>

      <section className="purchase-edit-card">
        <div className="purchase-inbound-head">
          <div>
            <h2>分批到货入库信息</h2>
            <p>基于当前采购跟进记录汇总,按入库数量自动判断下单状态和入库进度。</p>
          </div>
          <div>
            <span>累计入库 {track.arrivedQty} pcs</span>
            <button
              onClick={() =>
                onArrivalChange((current) => ({ ...current, arrivedQty: remainingQty }))
              }
              type="button"
            >
              全部入库
            </button>
            <button disabled={isPending} form="purchase-arrival-form" type="submit">
              到货入库
            </button>
          </div>
        </div>

        <div className="purchase-inbound-table-wrap">
          <table className="purchase-inbound-table">
            <thead>
              <tr>
                <th>入库时间</th>
                <th>入库单号</th>
                <th>入库数量</th>
                <th>来源</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {inboundRows.length ? (
                inboundRows.map((row) => (
                  <tr key={row.code}>
                    <td>{row.time}</td>
                    <td>{row.code}</td>
                    <td>{row.qty}</td>
                    <td>{row.source}</td>
                    <td>{row.note}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="purchase-empty" colSpan={5}>
                    暂无入库记录。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form
          className="purchase-arrival-form"
          id="purchase-arrival-form"
          onSubmit={onConfirmArrival}
        >
          <PurchaseField label="到货批次号">
            <input
              required
              value={arrivalForm.receiptBatchNo}
              onChange={(event) =>
                onArrivalChange((current) => ({
                  ...current,
                  receiptBatchNo: event.target.value,
                }))
              }
            />
          </PurchaseField>
          <PurchaseField label="到货数量">
            <input
              min={0.000001}
              step="any"
              type="number"
              value={arrivalForm.arrivedQty}
              onChange={(event) =>
                onArrivalChange((current) => ({
                  ...current,
                  arrivedQty: Number(event.target.value),
                }))
              }
            />
          </PurchaseField>
          <PurchaseField label="到货时间">
            <input
              type="datetime-local"
              value={arrivalForm.arrivedAt}
              onChange={(event) =>
                onArrivalChange((current) => ({
                  ...current,
                  arrivedAt: event.target.value,
                }))
              }
            />
          </PurchaseField>
          <PurchaseField label="备注">
            <input
              value={arrivalForm.note}
              onChange={(event) =>
                onArrivalChange((current) => ({ ...current, note: event.target.value }))
              }
            />
          </PurchaseField>
        </form>
      </section>

      <div className="purchase-edit-actions">
        <button onClick={onBack} type="button">
          取消
        </button>
        <button disabled={isPending} form="purchase-edit-form" type="submit">
          保存进度
        </button>
      </div>
    </div>
  );
}

function PurchaseField({
  children,
  hint,
  label,
}: {
  children: React.ReactNode;
  hint?: string;
  label: string;
}) {
  return (
    <label className="purchase-field">
      <span>{label}</span>
      {children}
      {hint ? <em>{hint}</em> : null}
    </label>
  );
}

function AdminWorkspace(props: WorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'batches' | 'products'>('batches');

  return (
    <div className="admin-workspace">
      <div className="admin-tabs">
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
      <PageTransition k={activeTab}>
        {activeTab === 'batches' ? <BatchWorkspace {...props} /> : <ProductWorkspace {...props} />}
      </PageTransition>
    </div>
  );
}

function OpsStatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'warn' | 'danger' | 'ok';
}) {
  return (
    <div className="ops-stat-card">
      <span>{label}</span>
      <strong className={`ops-stat-value ops-stat-${tone}`}>{value}</strong>
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
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
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
  const [batchFilter, setBatchFilter] = useState<'pending' | 'done' | 'all'>('pending');
  const [batchSearch, setBatchSearch] = useState('');

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

  const sharedGapTotal = data.pendingBatches.reduce(
    (sum, batch) =>
      sum +
      batch.sharedRequirements
        .filter((item) => item.isSharedMaterial)
        .reduce((itemSum, item) => itemSum + item.remainingQty, 0),
    0,
  );
  const actualFilledCount = data.pendingBatches.filter((batch) => batch.actual).length;
  const visibleBatches = data.pendingBatches.filter((batch) => {
    if (batchFilter === 'done' && batch.status !== 'COMPLETED') {
      return false;
    }
    if (batchFilter === 'pending' && batch.status === 'COMPLETED') {
      return false;
    }
    const query = batchSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return (
      batch.batchNo.toLowerCase().includes(query) ||
      batch.productName.toLowerCase().includes(query)
    );
  });
  const selectedBatch = selectedBatchId
    ? data.pendingBatches.find((batch) => batch.id === selectedBatchId)
    : null;

  if (selectedBatch) {
    return (
      <PageTransition k={`batch-${selectedBatch.id}`}>
        <BatchEditView
          actualDraft={actualDraft(selectedBatch)}
          allocationDraft={allocationDraft}
          batch={selectedBatch}
          data={data}
          isPending={isPending}
          onActualChange={(actual) =>
            setActualByBatch((current) => ({
              ...current,
              [selectedBatch.id]: actual,
            }))
          }
          onAllocationChange={(draft) =>
            setAllocationByBatch((current) => ({
              ...current,
              [selectedBatch.id]: draft,
            }))
          }
          onBack={() => setSelectedBatchId(null)}
          onSaveActual={() => saveActual(selectedBatch)}
          onSaveAllocation={saveAllocation}
          onStatusChange={(status) => changeStatus(selectedBatch.id, status)}
        />
      </PageTransition>
    );
  }

  return (
    <PageTransition k="batch-list">
      <div className="admin-batch-workspace">
      <div className="ops-stats-grid">
        <OpsStatCard label="待处理批次" value={data.pendingBatches.length} tone="warn" />
        <OpsStatCard label="异常 / 警报" value={0} />
        <OpsStatCard label="共用料缺口" value={sharedGapTotal} tone="danger" />
        <OpsStatCard label="实际结果已回填" value={actualFilledCount} />
      </div>

      <section className="ops-list-card">
        <div className="ops-list-header">
          <div className="ops-list-title">
            <h2>批次列表</h2>
            <p>点击“编辑”进入批次详情页处理共用料、状态和实际结果。</p>
          </div>
          <div className="ops-list-controls">
            <div className="ops-filter-group">
              {[
                { id: 'pending' as const, label: '待处理' },
                { id: 'done' as const, label: '已完成' },
                { id: 'all' as const, label: '全部' },
              ].map((item) => (
                <button
                  className={batchFilter === item.id ? 'active' : ''}
                  key={item.id}
                  onClick={() => setBatchFilter(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="ops-search">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="m21 21-4.3-4.3" />
                <circle cx="11" cy="11" r="7" />
              </svg>
              <input
                onChange={(event) => setBatchSearch(event.target.value)}
                placeholder="批次号 / 单品"
                value={batchSearch}
              />
            </label>
          </div>
        </div>

        <div className="ops-table-scroll">
        <table className="ops-admin-table batch-table">
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
            {visibleBatches.map((batch) => {
              const sharedGap = batch.sharedRequirements
                .filter((item) => item.isSharedMaterial)
                .reduce((sum, item) => sum + item.remainingQty, 0);

              return (
                <tr key={batch.id}>
                    <td>
                      <strong>{batch.batchNo}</strong>
                      <div>{batch.productName}</div>
                    </td>
                    <td>
                      <span className="ops-dot-status">
                        <span />
                        {batch.status}
                      </span>
                    </td>
                    <td>{batch.plannedQty}</td>
                    <td>{formatDate(batch.predictedLaunchDate)}</td>
                    <td className="ops-danger-text">{sharedGap}</td>
                    <td>
                      <div className="ops-reason-title">待齐套</div>
                      <div className="ops-reason-sub">{batch.blockingReason ?? '可上架'}</div>
                    </td>
                    <td>
                      <button
                        className="ops-table-link"
                        onClick={() => setSelectedBatchId(batch.id)}
                        type="button"
                      >
                        编辑
                      </button>
                    </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <div className="ops-list-footer">共 {visibleBatches.length} 条记录</div>
      </section>

      </div>
    </PageTransition>
  );
}

type BatchRecord = OperationBootstrap['pendingBatches'][number];
type BatchActualDraft = {
  actualStartAt: string;
  actualFinishAt: string;
  actualLaunchAt: string;
  actualLaunchQty: string;
};
type BatchAllocationDraft = {
  receiptBatchId: string;
  allocatedQty: number;
  note: string;
};

function batchStatusText(status: BatchRecord['status']) {
  if (status === 'COMPLETED') {
    return '已完成';
  }
  if (status === 'PAUSED') {
    return '暂缓';
  }
  return '待生产';
}

function BatchEditView({
  actualDraft,
  allocationDraft,
  batch,
  data,
  isPending,
  onActualChange,
  onAllocationChange,
  onBack,
  onSaveActual,
  onSaveAllocation,
  onStatusChange,
}: {
  actualDraft: BatchActualDraft;
  allocationDraft: (
    batchId: string,
    materialId: string,
    remainingQty: number,
  ) => BatchAllocationDraft;
  batch: BatchRecord;
  data: OperationBootstrap;
  isPending: boolean;
  onActualChange: (actual: BatchActualDraft) => void;
  onAllocationChange: (draft: BatchAllocationDraft) => void;
  onBack: () => void;
  onSaveActual: () => void;
  onSaveAllocation: (batchId: string, materialId: string, remainingQty: number) => void;
  onStatusChange: (status: 'PENDING' | 'PAUSED' | 'COMPLETED') => void;
}) {
  const sharedGap = batch.sharedRequirements
    .filter((item) => item.isSharedMaterial)
    .reduce((sum, item) => sum + item.remainingQty, 0);
  const statusOptions: Array<{ label: string; value: 'PENDING' | 'PAUSED' | 'COMPLETED' }> = [
    { label: '待生产', value: 'PENDING' },
    { label: '暂缓', value: 'PAUSED' },
    { label: '已完成', value: 'COMPLETED' },
  ];

  return (
    <div className="batch-detail-view">
      <div className="batch-detail-topline">
        <button className="batch-back-button" onClick={onBack} type="button">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m15 18-6-6 6-6" />
          </svg>
          返回批次列表
        </button>
        <div className="batch-detail-crumb">
          角色工作台 / 批次工作台 / <span>{batch.batchNo}</span>
        </div>
      </div>

      <section className="batch-detail-card batch-overview-card">
        <div className="batch-overview-head">
          <div>
            <h2>{batch.batchNo}</h2>
            <p>{batch.productName}</p>
          </div>
          <span className="ops-dot-status">
            <span />
            {batch.status}
          </span>
        </div>
        <div className="batch-overview-grid">
          {[
            ['计划量', batch.plannedQty],
            ['预计上架', formatDate(batch.predictedLaunchDate)],
            ['共用料缺口', sharedGap],
            ['关键原因', batch.blockingReason ?? '可上架'],
            ['创建', '—'],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="batch-detail-card">
        <h2 className="batch-section-title">子物料与共用料分配</h2>
        <div className="batch-material-list">
          {batch.sharedRequirements.map((item) => {
            const draft = allocationDraft(batch.id, item.materialId, item.remainingQty);
            const receipts = data.sharedReceiptBatches.filter(
              (receipt) => receipt.materialId === item.materialId,
            );
            const selectedReceipt = receipts.find(
              (receipt) => receipt.id === draft.receiptBatchId,
            );
            const maxAllocQty = Math.min(item.remainingQty, selectedReceipt?.remainingQty ?? 0);
            const done = item.remainingQty <= 0;

            return (
              <div className="batch-material-card" key={item.materialId}>
                <div className="batch-material-main">
                  <div>
                    <h3>{item.materialName}</h3>
                    <p>
                      需求 {item.requiredQty.toLocaleString()} · 已关联到货{' '}
                      {item.allocatedQty.toLocaleString()}
                    </p>
                    <p>
                      {item.isSharedMaterial ? '共用料' : '非共用料'} · 缺口{' '}
                      {item.remainingQty.toLocaleString()}
                    </p>
                  </div>
                  <span className={done ? 'batch-material-badge' : 'batch-material-badge warn'}>
                    {done ? '已关联到货' : '待分配'}
                  </span>
                </div>

                {item.isSharedMaterial && !done ? (
                  <div className="batch-allocation-controls">
                    <select
                      value={draft.receiptBatchId}
                      onChange={(event) => {
                        const nextReceipt = receipts.find(
                          (receipt) => receipt.id === event.target.value,
                        );
                        onAllocationChange({
                          ...draft,
                          receiptBatchId: event.target.value,
                          allocatedQty: Math.max(
                            Math.min(item.remainingQty, nextReceipt?.remainingQty ?? 0),
                            1,
                          ),
                        });
                      }}
                    >
                      <option value="">选择共用料批次</option>
                      {receipts.map((receipt) => (
                        <option key={receipt.id} value={receipt.id}>
                          {receipt.batchNo} · 余量 {receipt.remainingQty}
                        </option>
                      ))}
                    </select>
                    <input
                      min={0.000001}
                      max={maxAllocQty || 1}
                      step="any"
                      type="number"
                      value={draft.allocatedQty}
                      onChange={(event) =>
                        onAllocationChange({
                          ...draft,
                          allocatedQty: Math.min(
                            Number(event.target.value),
                            maxAllocQty || Number(event.target.value),
                          ),
                        })
                      }
                    />
                    <button
                      className="ops-secondary-button"
                      disabled={
                        isPending || !draft.receiptBatchId || item.remainingQty <= 0 || maxAllocQty <= 0
                      }
                      onClick={() => onSaveAllocation(batch.id, item.materialId, item.remainingQty)}
                      type="button"
                    >
                      分配
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="batch-detail-card batch-status-card">
        <div>
          <h2 className="batch-section-title">批次状态</h2>
          <div className="batch-status-options">
            {statusOptions.map((option) => (
              <button
                className={batchStatusText(batch.status) === option.label ? 'active' : ''}
                disabled={isPending}
                key={option.value}
                onClick={() => onStatusChange(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="batch-section-title">实际结果回填</h2>
          <div className="batch-actual-grid">
            <label>
              <span>实际开工</span>
              <input
                type="datetime-local"
                value={actualDraft.actualStartAt}
                onChange={(event) =>
                  onActualChange({ ...actualDraft, actualStartAt: event.target.value })
                }
              />
            </label>
            <label>
              <span>实际完成</span>
              <input
                type="datetime-local"
                value={actualDraft.actualFinishAt}
                onChange={(event) =>
                  onActualChange({ ...actualDraft, actualFinishAt: event.target.value })
                }
              />
            </label>
            <label>
              <span>实际上架</span>
              <input
                type="datetime-local"
                value={actualDraft.actualLaunchAt}
                onChange={(event) =>
                  onActualChange({ ...actualDraft, actualLaunchAt: event.target.value })
                }
              />
            </label>
            <label>
              <span>实际上架数量</span>
              <input
                min={0}
                type="number"
                value={actualDraft.actualLaunchQty}
                onChange={(event) =>
                  onActualChange({ ...actualDraft, actualLaunchQty: event.target.value })
                }
              />
            </label>
          </div>
        </div>

        <div className="batch-detail-actions">
          <button className="ops-secondary-button" onClick={onBack} type="button">
            取消
          </button>
          <button
            className="ops-primary-button"
            disabled={isPending}
            onClick={onSaveActual}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
              <path d="M17 21v-8H7v8" />
              <path d="M7 3v5h8" />
            </svg>
            保存实际结果
          </button>
        </div>
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
  const [previewBomVersionId, setPreviewBomVersionId] = useState<string | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showSubMaterialModal, setShowSubMaterialModal] = useState(false);
  const [showBomModal, setShowBomModal] = useState(false);
  const [showStockingModal, setShowStockingModal] = useState(false);
  const [stockingForm, setStockingForm] = useState<StockingRequestDraft>({
    targetFinishedQty: '1',
    remark: '',
    selectedBomItemIds: [],
  });
  const [bomForm, setBomForm] = useState<BomFormDraft>({
    productId: data.products[0]?.id ?? '',
    versionNo: 'BOM-V2',
    effectiveFrom: new Date().toISOString().slice(0, 16),
    remark: '',
    activate: false,
    items: [
      {
        materialMode: 'existing',
        materialId: data.materials[0]?.id ?? '',
        unitUsage: 1,
        isSharedMaterial: false,
      },
    ],
  });
  const selectedBom = data.activeBoms.find((bom) => bom.productId === selectedProductId);
  const selectedProduct = data.products.find((product) => product.id === selectedProductId);
  const selectedBomVersions = data.bomVersions.filter(
    (bom) => bom.productId === selectedProductId,
  );
  const previewBom =
    selectedBomVersions.find((bom) => bom.id === previewBomVersionId) ??
    selectedBomVersions.find((bom) => bom.isActive);
  const hasOpenProductionBatch = data.pendingBatches.some(
    (batch) =>
      batch.productId === selectedProductId &&
      (batch.status === 'PENDING' || batch.status === 'PAUSED'),
  );

  function openBomModal() {
    setBomForm((current) => ({
      ...current,
      productId: selectedProductId,
      activate: selectedBomVersions.length === 0,
    }));
    setShowBomModal(true);
  }

  function openStockingModal() {
    if (!selectedBom) {
      onError('当前单品没有生效 BOM，无法发起备货需求');
      return;
    }

    setStockingForm({
      targetFinishedQty: '1',
      remark: '',
      selectedBomItemIds: selectedBom.items.map((item) => item.id),
    });
    setShowStockingModal(true);
  }

  function saveBomVersion() {
    onMessage(null);
    onError(null);

    if (!selectedProductId || !bomForm.versionNo.trim()) {
      onError('请输入 BOM 版本号');
      return;
    }

    startTransition(async () => {
      try {
        const items = await Promise.all(
          bomForm.items.map(async (item) => {
            if (item.materialMode !== 'new') {
              return {
                materialId: item.materialId,
                unitUsage: Number(item.unitUsage),
                isSharedMaterial: item.isSharedMaterial,
              };
            }

            if (!item.materialName?.trim() || !item.materialCode?.trim()) {
              throw new Error('请输入新增子料的名称和编码');
            }

            const material = await createMaterial(
              {
                materialName: item.materialName,
                materialCode: item.materialCode,
                materialSpec: item.materialSpec || undefined,
                unit: item.materialUnit || 'pcs',
              },
              token,
            );

            return {
              materialId: material.id,
              unitUsage: Number(item.unitUsage),
              isSharedMaterial: item.isSharedMaterial,
            };
          }),
        );

        await createBomVersion(
          {
            ...bomForm,
            productId: selectedProductId,
            remark: bomForm.remark || undefined,
            items,
          },
          token,
        );
        await onRefresh();
        onMessage('BOM 版本已保存');
        setBomForm((current) => ({
          ...current,
          versionNo: 'BOM-V2',
          remark: '',
          activate: false,
        }));
        setShowBomModal(false);
      } catch (submissionError) {
        onError(submissionError instanceof Error ? submissionError.message : 'BOM 保存失败');
      }
    });
  }

  function activateBom(version: OperationBootstrap['bomVersions'][number]) {
    if (version.isActive) {
      setPreviewBomVersionId(version.id);
      return;
    }

    if (
      hasOpenProductionBatch &&
      !window.confirm('当前存在未完成生产批次，切换 BOM 只影响后续新批次，不影响已有批次。是否继续？')
    ) {
      return;
    }

    onMessage(null);
    onError(null);

    startTransition(async () => {
      try {
        await activateBomVersion(version.id, token);
        await onRefresh();
        setPreviewBomVersionId(version.id);
        onMessage('BOM 版本已启用');
      } catch (submissionError) {
        onError(submissionError instanceof Error ? submissionError.message : '启用 BOM 失败');
      }
    });
  }

  function saveProduct(draft: ProductDraft) {
    onMessage(null);
    onError(null);

    startTransition(async () => {
      try {
        const created = await createProduct(
          {
            productCode: draft.code,
            productName: draft.name,
            productSpec: draft.spec || undefined,
            unit: draft.unit,
            minStartQty: Number(draft.minQty),
            standardProductionDays: Number(draft.stdDays),
            bufferDays: Number(draft.bufferDays),
            shortWindowDays: Number(draft.windowDays),
          },
          token,
        );
        await onRefresh();
        setSelectedProductId(created.id);
        setBomForm((current) => ({ ...current, productId: created.id }));
        setShowProductModal(false);
        onMessage('单品已新增');
      } catch (submissionError) {
        onError(submissionError instanceof Error ? submissionError.message : '新增单品失败');
      }
    });
  }

  function saveMaterial(draft: MaterialDraft) {
    onMessage(null);
    onError(null);

    startTransition(async () => {
      try {
        await createMaterial(
          {
            materialCode: draft.code,
            materialName: draft.name,
            materialSpec: draft.spec || undefined,
            unit: draft.unit,
          },
          token,
        );
        await onRefresh();
        setShowSubMaterialModal(false);
        onMessage('子料件已新增');
      } catch (submissionError) {
        onError(submissionError instanceof Error ? submissionError.message : '新增子料件失败');
      }
    });
  }

  function saveStockingRequest() {
    onMessage(null);
    onError(null);

    const targetFinishedQty = Number(stockingForm.targetFinishedQty);
    if (!selectedProductId || !Number.isFinite(targetFinishedQty) || targetFinishedQty <= 0) {
      onError('请输入大于 0 的目标成品数量');
      return;
    }

    if (stockingForm.selectedBomItemIds.length === 0) {
      onError('请至少选择一个子料生成采购跟进');
      return;
    }

    startTransition(async () => {
      try {
        const created = await createStockingRequest(
          {
            productId: selectedProductId,
            targetFinishedQty,
            selectedBomItemIds: stockingForm.selectedBomItemIds,
            remark: stockingForm.remark || undefined,
          },
          token,
        );
        await onRefresh();
        setShowStockingModal(false);
        onMessage(`备货需求 ${created.requestNo} 已生成 ${created.createdTrackCount} 条采购跟进`);
      } catch (submissionError) {
        onError(submissionError instanceof Error ? submissionError.message : '发起备货需求失败');
      }
    });
  }

  return (
    <div className="admin-product-workspace">
      <div className="admin-product-breadcrumb">
        <span>角色工作台</span>
        <span>›</span>
        <strong>单品与 BOM</strong>
      </div>

      <div className="admin-product-header">
        <div>
          <h2>单品列表</h2>
          <p>先维护单品和子料件,再点击单品创建 BOM 组合。</p>
        </div>
        <div className="admin-product-actions">
          <button
            className="ops-secondary-button"
            onClick={() => setShowSubMaterialModal(true)}
            type="button"
          >
            新增子料件
          </button>
          <button
            className="ops-primary-button"
            onClick={() => setShowProductModal(true)}
            type="button"
          >
            新增单品
          </button>
        </div>
      </div>

      <div className="admin-product-grid">
        <section className="admin-product-tree">
          <h3>单品树</h3>
          <div className="admin-product-list">
            {data.products.map((product) => {
              const active = selectedProductId === product.id;
              return (
                <button
                  className={active ? 'active' : ''}
                  key={product.id}
                  onClick={() => {
                    setSelectedProductId(product.id);
                    setPreviewBomVersionId(null);
                    setBomForm((current) => ({ ...current, productId: product.id }));
                  }}
                  type="button"
                >
                  <strong>{product.name}</strong>
                  <span>{product.code}</span>
                </button>
              );
            })}
          </div>

          <div className="admin-material-summary">
            <span>子料件</span>
            <strong>已维护 {data.materials.length} 个子料件</strong>
          </div>
        </section>

        <section className="admin-bom-card">
          <div className="admin-bom-header">
            <div>
              <h3>{selectedProduct?.name ?? '未选择单品'}</h3>
              <p>{selectedProduct?.code ?? '—'}</p>
            </div>
            <div className="admin-bom-version-actions">
              <button
                className="ops-secondary-button"
                disabled={!selectedBom}
                onClick={openStockingModal}
                type="button"
              >
                发起备货需求
              </button>
              <button
                className="ops-primary-button"
                onClick={openBomModal}
                type="button"
              >
                新增 BOM 版本
              </button>
            </div>
          </div>

          <div className="admin-bom-meta-grid">
            <div className="highlight">
              <span>当前 BOM</span>
              <strong>{selectedBom?.versionNo ?? '—'}</strong>
              {selectedBom ? <em>当前生效</em> : null}
            </div>
            <div>
              <span>生效时间</span>
              <strong>{selectedBom ? formatDate(selectedBom.effectiveFrom) : '—'}</strong>
            </div>
            <div>
              <span>子料数量</span>
              <strong className="count">{selectedBom?.items.length ?? 0}</strong>
            </div>
          </div>

          <div className="admin-bom-version-panel">
            <div className="admin-bom-section-head">
              <h4>BOM 版本列表</h4>
              <span>共 {selectedBomVersions.length} 个版本</span>
            </div>
            <div className="admin-bom-version-table-wrap">
              <table className="admin-bom-version-table">
                <thead>
                  <tr>
                    <th>版本号</th>
                    <th>状态</th>
                    <th>生效时间</th>
                    <th>子料数量</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBomVersions.length ? (
                    selectedBomVersions.map((bom) => (
                      <tr key={bom.id}>
                        <td>{bom.versionNo}</td>
                        <td>
                          <span className={bom.isActive ? 'bom-status active' : 'bom-status'}>
                            {bom.isActive ? '当前生效' : '未生效'}
                          </span>
                        </td>
                        <td>{formatDate(bom.effectiveFrom)}</td>
                        <td>{bom.itemCount}</td>
                        <td>
                          <div className="admin-bom-version-actions">
                            <button
                              className="ops-secondary-button"
                              onClick={() => setPreviewBomVersionId(bom.id)}
                              type="button"
                            >
                              查看
                            </button>
                            {bom.isActive ? null : (
                              <button
                                className="ops-primary-button"
                                disabled={isPending}
                                onClick={() => activateBom(bom)}
                                type="button"
                              >
                                启用此版本
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>暂无 BOM 版本</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-bom-section-head">
            <h4>{previewBom?.isActive ? '当前生效 BOM 子料' : '查看 BOM 子料'}</h4>
            <span>{previewBom?.versionNo ?? '—'}</span>
          </div>
          <div className="admin-bom-table-wrap">
            <table className="admin-bom-table">
              <thead>
                <tr>
                  <th>子料编码</th>
                  <th>子料名称</th>
                  <th>规格</th>
                  <th>单耗</th>
                  <th>用料类型</th>
                </tr>
              </thead>
              <tbody>
                {previewBom?.items.length ? (
                  previewBom.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.materialCode}</td>
                      <td>{item.materialName}</td>
                      <td className="muted">{item.materialSpec ?? item.materialUnit ?? '—'}</td>
                      <td>{item.unitUsage}</td>
                      <td>
                        <span className={item.isSharedMaterial ? 'bom-type shared' : 'bom-type'}>
                          {item.isSharedMaterial ? '共用料' : '非共用料'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>尚未配置 BOM</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <AddProductModal
        open={showProductModal}
        onClose={() => setShowProductModal(false)}
        onSubmit={saveProduct}
      />
      <AddSubMaterialModal
        open={showSubMaterialModal}
        onClose={() => setShowSubMaterialModal(false)}
        onSubmit={saveMaterial}
      />
      <AddBomModal
        bomForm={bomForm}
        isPending={isPending}
        materials={data.materials}
        onClose={() => setShowBomModal(false)}
        onSave={saveBomVersion}
        open={showBomModal}
        setBomForm={setBomForm}
      />
      <StockingRequestModal
        bom={selectedBom}
        draft={stockingForm}
        isPending={isPending}
        onClose={() => setShowStockingModal(false)}
        onSave={saveStockingRequest}
        open={showStockingModal}
        productName={selectedProduct?.name ?? ''}
        setDraft={setStockingForm}
      />
    </div>
  );
}

type BomFormDraft = {
  productId: string;
  versionNo: string;
  effectiveFrom: string;
  remark: string;
  activate: boolean;
  items: Array<{
    materialMode?: 'existing' | 'new';
    materialId: string;
    materialName?: string;
    materialCode?: string;
    materialSpec?: string;
    materialUnit?: string;
    unitUsage: number;
    isSharedMaterial: boolean;
  }>;
};

type ProductDraft = {
  code: string;
  name: string;
  spec: string;
  unit: string;
  minQty: string;
  stdDays: number;
  bufferDays: number;
  windowDays: number;
};

type MaterialDraft = {
  code: string;
  name: string;
  spec: string;
  unit: string;
};

type StockingRequestDraft = {
  targetFinishedQty: string;
  remark: string;
  selectedBomItemIds: string[];
};

function AddProductModal({
  onClose,
  onSubmit,
  open,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (draft: ProductDraft) => void;
}) {
  const [draft, setDraft] = useState<ProductDraft>({
    code: '',
    name: '',
    spec: '',
    unit: '件',
    minQty: '1',
    stdDays: 5,
    bufferDays: 2,
    windowDays: 7,
  });

  function submit() {
    if (!draft.code || !draft.name) {
      return;
    }
    onSubmit(draft);
  }

  return (
    <Modal
      footer={
        <>
          <AppButton onClick={onClose} type="button" variant="secondary">
            取消
          </AppButton>
          <AppButton onClick={submit} type="button">
            保存单品
          </AppButton>
        </>
      }
      onClose={onClose}
      open={open}
      title="新增单品"
      width={640}
    >
      <div className="app-modal-grid">
        <FormField label="单品名称" required>
          <input
            className={inputCls}
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />
        </FormField>
        <FormField label="单品编码" required>
          <input
            className={inputCls}
            value={draft.code}
            onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))}
          />
        </FormField>
        <FormField label="规格(净含量)">
          <input
            className={inputCls}
            value={draft.spec}
            onChange={(event) => setDraft((current) => ({ ...current, spec: event.target.value }))}
          />
        </FormField>
        <FormField label="单位">
          <input
            className={inputCls}
            value={draft.unit}
            onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))}
          />
        </FormField>
        <FormField label="最低开工量">
          <input
            className={inputCls}
            min={1}
            type="number"
            value={draft.minQty}
            onChange={(event) =>
              setDraft((current) => ({ ...current, minQty: event.target.value }))
            }
          />
        </FormField>
        <FormField label="标准生产天数">
          <input
            className={inputCls}
            min={1}
            type="number"
            value={draft.stdDays}
            onChange={(event) =>
              setDraft((current) => ({ ...current, stdDays: Number(event.target.value) }))
            }
          />
        </FormField>
        <FormField label="缓冲天数">
          <input
            className={inputCls}
            min={0}
            type="number"
            value={draft.bufferDays}
            onChange={(event) =>
              setDraft((current) => ({ ...current, bufferDays: Number(event.target.value) }))
            }
          />
        </FormField>
        <FormField label="短期窗口天数">
          <input
            className={inputCls}
            min={1}
            type="number"
            value={draft.windowDays}
            onChange={(event) =>
              setDraft((current) => ({ ...current, windowDays: Number(event.target.value) }))
            }
          />
        </FormField>
      </div>
    </Modal>
  );
}

function AddSubMaterialModal({
  onClose,
  onSubmit,
  open,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (draft: MaterialDraft) => void;
}) {
  const [draft, setDraft] = useState<MaterialDraft>({
    code: '',
    name: '',
    spec: '',
    unit: 'pcs',
  });

  function submit() {
    if (!draft.code || !draft.name) {
      return;
    }
    onSubmit(draft);
    setDraft({ code: '', name: '', spec: '', unit: 'pcs' });
  }

  return (
    <Modal
      footer={
        <>
          <AppButton onClick={onClose} type="button" variant="secondary">
            取消
          </AppButton>
          <AppButton onClick={submit} type="button">
            保存子件
          </AppButton>
        </>
      }
      onClose={onClose}
      open={open}
      title="新增子件"
      width={600}
    >
      <div className="app-modal-grid">
        <FormField label="子料名称" required>
          <input
            className={inputCls}
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />
        </FormField>
        <FormField label="子料编码" required>
          <input
            className={inputCls}
            value={draft.code}
            onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))}
          />
        </FormField>
        <FormField label="规格">
          <input
            className={inputCls}
            value={draft.spec}
            onChange={(event) => setDraft((current) => ({ ...current, spec: event.target.value }))}
          />
        </FormField>
        <FormField label="单位">
          <input
            className={inputCls}
            value={draft.unit}
            onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))}
          />
        </FormField>
      </div>
    </Modal>
  );
}

function StockingRequestModal({
  bom,
  draft,
  isPending,
  onClose,
  onSave,
  open,
  productName,
  setDraft,
}: {
  bom: OperationBootstrap['activeBoms'][number] | undefined;
  draft: StockingRequestDraft;
  isPending: boolean;
  onClose: () => void;
  onSave: () => void;
  open: boolean;
  productName: string;
  setDraft: React.Dispatch<React.SetStateAction<StockingRequestDraft>>;
}) {
  const targetFinishedQty = Number(draft.targetFinishedQty);
  const previewQty = Number.isFinite(targetFinishedQty) ? targetFinishedQty : 0;

  function toggleBomItem(itemId: string, checked: boolean) {
    setDraft((current) => ({
      ...current,
      selectedBomItemIds: checked
        ? [...new Set([...current.selectedBomItemIds, itemId])]
        : current.selectedBomItemIds.filter((selectedId) => selectedId !== itemId),
    }));
  }

  return (
    <Modal
      footer={
        <>
          <AppButton onClick={onClose} type="button" variant="secondary">
            取消
          </AppButton>
          <AppButton disabled={isPending} onClick={onSave} type="button">
            确认生成
          </AppButton>
        </>
      }
      onClose={onClose}
      open={open}
      title="发起备货需求"
      width={920}
    >
      <div className="app-modal-grid">
        <FormField label="单品">
          <input className={inputCls} disabled value={productName} />
        </FormField>
        <FormField label="当前 BOM">
          <input className={inputCls} disabled value={bom?.versionNo ?? '—'} />
        </FormField>
        <FormField label="目标成品数量" required>
          <input
            className={inputCls}
            min={0.000001}
            step="any"
            type="number"
            value={draft.targetFinishedQty}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                targetFinishedQty: event.target.value,
              }))
            }
          />
        </FormField>
        <FormField label="备注">
          <input
            className={inputCls}
            value={draft.remark}
            onChange={(event) =>
              setDraft((current) => ({ ...current, remark: event.target.value }))
            }
          />
        </FormField>
      </div>

      <div className="admin-bom-table-wrap">
        <table className="admin-bom-table">
          <thead>
            <tr>
              <th>生成</th>
              <th>子料名称</th>
              <th>子料编码</th>
              <th>单耗</th>
              <th>需求数量</th>
              <th>用料类型</th>
            </tr>
          </thead>
          <tbody>
            {bom?.items.length ? (
              bom.items.map((item) => {
                const checked = draft.selectedBomItemIds.includes(item.id);
                return (
                  <tr key={item.id}>
                    <td>
                      <input
                        checked={checked}
                        onChange={(event) => toggleBomItem(item.id, event.target.checked)}
                        type="checkbox"
                      />
                    </td>
                    <td>{item.materialName}</td>
                    <td>{item.materialCode}</td>
                    <td>{item.unitUsage}</td>
                    <td>
                      {formatDemandQty(previewQty * item.unitUsage)} {item.materialUnit ?? 'pcs'}
                    </td>
                    <td>
                      <span className={item.isSharedMaterial ? 'bom-type shared' : 'bom-type'}>
                        {item.isSharedMaterial ? '共用料' : '非共用料'}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6}>当前单品没有生效 BOM 子料。</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function AddBomModal({
  bomForm,
  isPending,
  materials,
  onClose,
  onSave,
  open,
  setBomForm,
}: {
  bomForm: BomFormDraft;
  isPending: boolean;
  materials: OperationBootstrap['materials'];
  onClose: () => void;
  onSave: () => void;
  open: boolean;
  setBomForm: (updater: (current: BomFormDraft) => BomFormDraft) => void;
}) {
  function updateBomItem(
    index: number,
    patch: Partial<BomFormDraft['items'][number]>,
  ) {
    setBomForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  return (
    <Modal
      footer={
        <>
          <AppButton
            className="app-modal-footer-left"
            onClick={() =>
              setBomForm((current) => ({
                ...current,
                items: [
                  ...current.items,
                  {
                    materialMode: 'existing',
                    materialId: materials[0]?.id ?? '',
                    unitUsage: 1,
                    isSharedMaterial: false,
                  },
                ],
              }))
            }
            type="button"
            variant="secondary"
          >
            选择已有子料
          </AppButton>
          <AppButton
            onClick={() =>
              setBomForm((current) => ({
                ...current,
                items: [
                  ...current.items,
                  {
                    materialMode: 'new',
                    materialId: '',
                    materialName: '',
                    materialCode: '',
                    materialSpec: '',
                    materialUnit: 'pcs',
                    unitUsage: 1,
                    isSharedMaterial: false,
                  },
                ],
              }))
            }
            type="button"
            variant="secondary"
          >
            新增子料
          </AppButton>
          <AppButton onClick={onClose} type="button" variant="secondary">
            取消
          </AppButton>
          <AppButton disabled={isPending} onClick={onSave} type="button">
            保存 BOM
          </AppButton>
        </>
      }
      onClose={onClose}
      open={open}
      title="新增 BOM 版本"
      width={720}
    >
      <div className="app-modal-grid">
        <FormField label="BOM 版本号" required>
          <input
            className={inputCls}
            value={bomForm.versionNo}
            onChange={(event) =>
              setBomForm((current) => ({ ...current, versionNo: event.target.value }))
            }
          />
        </FormField>
        <FormField label="生效时间" required>
          <input
            className={inputCls}
            type="datetime-local"
            value={bomForm.effectiveFrom}
            onChange={(event) =>
              setBomForm((current) => ({ ...current, effectiveFrom: event.target.value }))
            }
          />
        </FormField>
      </div>

      <label className="app-modal-checkbox">
        <input
          checked={bomForm.activate}
          onChange={(event) =>
            setBomForm((current) => ({ ...current, activate: event.target.checked }))
          }
          type="checkbox"
        />
        BOM 立即生效
      </label>

      <FormField label="备注">
        <textarea
          className="app-modal-textarea"
          rows={3}
          value={bomForm.remark}
          onChange={(event) =>
            setBomForm((current) => ({ ...current, remark: event.target.value }))
          }
        />
      </FormField>

      <div className="app-bom-editor">
        <div className="app-bom-editor-head">
          <span>子料</span>
          <span>单耗</span>
          <span>用料类型</span>
          <span />
        </div>
        {bomForm.items.map((item, index) => (
          <div className="app-bom-editor-row" key={`${index}-${item.materialId}`}>
            <div className="app-bom-material-cell">
              <select
                className={selectCls}
                value={item.materialMode ?? 'existing'}
                onChange={(event) =>
                  updateBomItem(index, {
                    materialMode: event.target.value as 'existing' | 'new',
                    materialId:
                      event.target.value === 'existing' ? materials[0]?.id ?? '' : '',
                  })
                }
              >
                <option value="existing">选择已有子料</option>
                <option value="new">新增子料</option>
              </select>
              {(item.materialMode ?? 'existing') === 'new' ? (
                <div className="app-bom-new-material-grid">
                  <input
                    className={inputCls}
                    placeholder="子料名称"
                    value={item.materialName ?? ''}
                    onChange={(event) =>
                      updateBomItem(index, { materialName: event.target.value })
                    }
                  />
                  <input
                    className={inputCls}
                    placeholder="子料编码"
                    value={item.materialCode ?? ''}
                    onChange={(event) =>
                      updateBomItem(index, { materialCode: event.target.value })
                    }
                  />
                  <input
                    className={inputCls}
                    placeholder="规格"
                    value={item.materialSpec ?? ''}
                    onChange={(event) =>
                      updateBomItem(index, { materialSpec: event.target.value })
                    }
                  />
                  <input
                    className={inputCls}
                    placeholder="单位"
                    value={item.materialUnit ?? 'pcs'}
                    onChange={(event) =>
                      updateBomItem(index, { materialUnit: event.target.value })
                    }
                  />
                </div>
              ) : (
                <select
                  className={selectCls}
                  value={item.materialId}
                  onChange={(event) => updateBomItem(index, { materialId: event.target.value })}
                >
                  {materials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.code}・{material.name}・{material.unit}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <input
              className={inputCls}
              min={0.000001}
              step="any"
              type="number"
              value={item.unitUsage}
              onChange={(event) => updateBomItem(index, { unitUsage: Number(event.target.value) })}
            />
            <select
              className={selectCls}
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
            <button
              className="app-bom-delete-button"
              disabled={bomForm.items.length <= 1}
              onClick={() =>
                setBomForm((current) => ({
                  ...current,
                  items: current.items.filter((_, itemIndex) => itemIndex !== index),
                }))
              }
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="m19 6-1 14H6L5 6" />
                <path d="M10 11v5" />
                <path d="M14 11v5" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
