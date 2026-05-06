'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { ProductDetail } from '@/lib/types';
import { collapseSpring } from '@/components/page-transition';

const fadeSpring = {
  type: 'spring' as const,
  stiffness: 340,
  damping: 32,
  mass: 0.75,
};

function formatDate(input: string | null) {
  if (!input) {
    return '待确认';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(input));
}

function formatBomVersion(input: string | null | undefined) {
  if (!input) {
    return '暂无版本';
  }

  return `v${formatDate(input).replaceAll('/', '.')}`;
}

function displayState(state: string) {
  if (state === 'LAUNCHABLE') {
    return '可上架';
  }

  if (state === 'SCHEDULABLE') {
    return '可排序';
  }

  if (state === 'COMPLETED') {
    return '已完结';
  }

  return '受阻';
}

function displayBatchStatus(status: string, blockingReason: string | null) {
  if (status === 'COMPLETED') {
    return 'DONE';
  }

  if (status === 'PAUSED') {
    return 'PAUSED';
  }

  if (blockingReason) {
    return 'BLOCKED';
  }

  return 'PENDING';
}

function sharedAllocationText(
  allocations: Array<{ materialName: string; allocatedQty: number }>,
) {
  if (!allocations.length) {
    return '暂无';
  }

  return allocations
    .map((item) => `${item.materialName} ${item.allocatedQty}`)
    .join('，');
}

export function ProductDetailView({ detail }: { detail: ProductDetail }) {
  const bomItems = detail.bom?.items ?? [];
  const sharedBomCount = bomItems.filter((item) => item.isSharedMaterial).length;
  const [bomOpen, setBomOpen] = useState(true);
  const [openBatchId, setOpenBatchId] = useState<string | null>(
    detail.productionBatches[0]?.id ?? null,
  );

  return (
    <div className="detail-shell">
      <section className="detail-hero">
        <Link href="/" className="detail-back-link">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m15 18-6-6 6-6" />
            <path d="M20 12H9" />
          </svg>
          返回列表
        </Link>

        <div className="detail-title-block">
          <span className="detail-eyebrow">Product Detail</span>
          <div className="detail-title-row">
            <h1>{detail.name}</h1>
            <span className="detail-state-pill">{displayState(detail.state)}</span>
          </div>
          <p>
            <span>{detail.code}</span> · {detail.reasonSummary}
          </p>
        </div>
      </section>

      <section className="detail-kpi-grid">
        <div className="detail-kpi-card">
          <div className="detail-kpi-label">本轮可上架量</div>
          <div className="detail-kpi-value">{detail.roundLaunchQty}</div>
        </div>
        <div className="detail-kpi-card">
          <div className="detail-kpi-label">已分配上架量</div>
          <div className="detail-kpi-value">{detail.allocatedLaunchQty}</div>
        </div>
        <div className="detail-kpi-card">
          <div className="detail-kpi-label">剩余可分配上架量</div>
          <div className="detail-kpi-value">{detail.remainingAllocatableQty}</div>
        </div>
        <div className="detail-kpi-card">
          <div className="detail-kpi-label">下一批预计上架时间</div>
          <div className="detail-kpi-value detail-kpi-value-small">
            {formatDate(detail.nextLaunchDate)}
          </div>
        </div>
      </section>

      <section className="detail-bom-card">
        <button
          aria-expanded={bomOpen}
          className="detail-bom-header"
          onClick={() => setBomOpen((current) => !current)}
          type="button"
        >
          <div>
            <span className="detail-mono-label">BOM</span>
            <span className="detail-bom-version">
              {formatBomVersion(detail.bom?.effectiveFrom)}
            </span>
            <span className="detail-bom-meta">
              · {bomItems.length} 个子料 · {sharedBomCount} 共用
            </span>
          </div>
          <svg
            aria-hidden="true"
            className={bomOpen ? 'open' : ''}
            viewBox="0 0 24 24"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <AnimatePresence initial={false}>
          {bomOpen ? (
            <motion.div
              animate={{ height: 'auto', opacity: 1 }}
              className="detail-bom-collapse"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              transition={collapseSpring}
            >
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                initial={{ opacity: 0, y: -8 }}
                transition={fadeSpring}
              >
                <div className="detail-bom-list">
                  {bomItems.length ? (
                    bomItems.map((item) => (
                      <div className="detail-bom-item" key={item.id}>
                        <div>
                          <strong>{item.materialName}</strong>
                          <p>
                            {item.materialCode} · 单耗 {item.unitUsage}
                          </p>
                        </div>
                        {item.isSharedMaterial ? (
                          <span className="detail-blue-pill">共用料</span>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="detail-empty">暂无生效 BOM</div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>

      <section className="detail-section">
        <div className="detail-section-heading">
          <span>Production Batches</span>
          <h2>生产批次</h2>
        </div>
        <div className="detail-batch-card">
          <div className="detail-batch-scroll">
            <table className="detail-batch-table">
              <thead>
                <tr>
                  <th className="detail-chevron-cell" />
                  <th>批次</th>
                  <th>状态</th>
                  <th className="detail-align-right">计划</th>
                  <th>预计上架</th>
                  <th>共用料分配</th>
                  <th>受阻原因</th>
                </tr>
              </thead>
              <tbody>
                {detail.productionBatches.map((batch) => {
                  const isOpen = batch.id === openBatchId;
                  const batchStatus = displayBatchStatus(
                    batch.status,
                    batch.blockingReason,
                  );

                  return (
                    <Fragment key={batch.id}>
                      <tr
                        className="detail-batch-row"
                        onClick={() => setOpenBatchId(isOpen ? null : batch.id)}
                      >
                        <td className="detail-chevron-cell">
                          <button
                            aria-expanded={isOpen}
                            className="detail-chevron-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenBatchId(isOpen ? null : batch.id);
                            }}
                            type="button"
                          >
                            <svg
                              aria-hidden="true"
                              className={isOpen ? 'open' : ''}
                              viewBox="0 0 24 24"
                            >
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </button>
                        </td>
                        <td>
                          <span className="detail-batch-no">{batch.batchNo}</span>
                        </td>
                        <td>
                          <span
                            className={`detail-batch-status detail-batch-status-${batchStatus.toLowerCase()}`}
                          >
                            {batchStatus}
                          </span>
                        </td>
                        <td className="detail-align-right detail-tabular">
                          {batch.plannedQty}
                        </td>
                        <td>
                          <span className="detail-mono-date">
                            {formatDate(batch.predictedLaunchDate)}
                          </span>
                        </td>
                        <td>{sharedAllocationText(batch.sharedAllocations)}</td>
                        <td className="detail-blocking-reason">
                          {batch.blockingReason ?? '—'}
                        </td>
                      </tr>
                      <AnimatePresence initial={false}>
                        {isOpen ? (
                          <motion.tr
                            animate={{ opacity: 1 }}
                            className="detail-actual-row open"
                            exit={{ opacity: 0 }}
                            initial={{ opacity: 0 }}
                            transition={fadeSpring}
                          >
                            <td colSpan={7}>
                              <motion.div
                                animate={{ height: 'auto', opacity: 1 }}
                                className="detail-actual-collapse"
                                exit={{ height: 0, opacity: 0 }}
                                initial={{ height: 0, opacity: 0 }}
                                transition={collapseSpring}
                              >
                                <motion.div
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -8 }}
                                  initial={{ opacity: 0, y: -8 }}
                                  transition={fadeSpring}
                                >
                                  <div className="detail-actual-inner">
                                    <div className="detail-actual-label">Actual Result</div>
                                    <div className="detail-actual-grid">
                                      <div>
                                        <span>实际开工</span>
                                        <strong>
                                          {formatDate(batch.actual?.startAt ?? null)}
                                        </strong>
                                      </div>
                                      <div>
                                        <span>实际完成</span>
                                        <strong>
                                          {formatDate(batch.actual?.finishAt ?? null)}
                                        </strong>
                                      </div>
                                      <div>
                                        <span>实际上架</span>
                                        <strong>
                                          {formatDate(batch.actual?.launchAt ?? null)}
                                        </strong>
                                      </div>
                                      <div>
                                        <span>实际上架数量</span>
                                        <strong>
                                          {batch.actual?.launchQty ?? '待回填'}
                                        </strong>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              </motion.div>
                            </td>
                          </motion.tr>
                        ) : null}
                      </AnimatePresence>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
