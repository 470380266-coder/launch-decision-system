import { OperationBootstrap, ProductDetail, ProductListItem } from './types';

export const mockProducts: ProductListItem[] = [
  {
    id: 'demo-product-1',
    code: 'SKU-LIVE-001',
    name: '直播爆品精华水',
    minStartQty: 100,
    standardProductionDays: 5,
    bufferDays: 2,
    status: 'SCHEDULABLE',
    launchableQtyNow: 0,
    shortTermIncrementQty: 150,
    nextLaunchDate: '2026-05-05T01:00:00.000Z',
    reasonSummary: '已形成待生产批次 PB-0001，等待生产完成',
  },
];

export const mockProductDetail: ProductDetail = {
  id: 'demo-product-1',
  code: 'SKU-LIVE-001',
  name: '直播爆品精华水',
  state: 'SCHEDULABLE',
  launchableQtyNow: 0,
  shortTermIncrementQty: 150,
  nextLaunchDate: '2026-05-05T01:00:00.000Z',
  reasonSummary: '已形成待生产批次 PB-0001，等待生产完成',
  bom: {
    version: 'BOM-V1',
    effectiveFrom: '2026-04-01T00:00:00.000Z',
    items: [
      { id: '1', materialCode: 'MAT-BOTTLE', materialName: '瓶身', unitUsage: 1, isSharedMaterial: false },
      { id: '2', materialCode: 'MAT-CAP', materialName: '瓶盖', unitUsage: 1, isSharedMaterial: false },
      { id: '3', materialCode: 'MAT-BOX', materialName: '彩盒', unitUsage: 1, isSharedMaterial: false },
      { id: '4', materialCode: 'MAT-STICKER', materialName: '通用贴纸', unitUsage: 1, isSharedMaterial: true },
    ],
  },
  productionBatches: [
    {
      id: 'pb-1',
      batchNo: 'PB-0001',
      plannedQty: 150,
      status: 'PENDING',
      predictedStartDate: '2026-04-28T01:00:00.000Z',
      predictedFinishDate: '2026-05-03T01:00:00.000Z',
      predictedLaunchDate: '2026-05-05T01:00:00.000Z',
      blockingReason: '当前瓶颈子料：通用贴纸',
      sharedAllocations: [
        {
          id: 'alloc-1',
          materialName: '通用贴纸',
          allocatedQty: 150,
          arrivedAt: '2026-04-27T08:00:00.000Z',
        },
      ],
      actual: null,
    },
  ],
  blockedBatches: [
    {
      id: 'pb-1',
      batchNo: 'PB-0001',
      blockingReason: '当前瓶颈子料：通用贴纸',
      predictedLaunchDate: '2026-05-05T01:00:00.000Z',
    },
  ],
};

export const mockOperations: OperationBootstrap = {
  materials: [
    { id: 'mat-1', code: 'MAT-BOTTLE', name: '瓶身', unit: 'pcs' },
    { id: 'mat-2', code: 'MAT-CAP', name: '瓶盖', unit: 'pcs' },
    { id: 'mat-3', code: 'MAT-BOX', name: '彩盒', unit: 'pcs' },
    { id: 'mat-4', code: 'MAT-STICKER', name: '通用贴纸', unit: 'pcs' },
  ],
  products: [{ id: 'demo-product-1', code: 'SKU-LIVE-001', name: '直播爆品精华水' }],
  purchasers: [{ id: 'user-p1', name: '采购A', username: 'purchaser_a' }],
  admins: [{ id: 'user-a1', name: '系统管理员', username: 'admin' }],
  pendingBatches: [
    {
      id: 'pb-1',
      batchNo: 'PB-0001',
      productId: 'demo-product-1',
      productName: '直播爆品精华水',
      status: 'PENDING',
      plannedQty: 150,
      predictedLaunchDate: '2026-05-05T01:00:00.000Z',
      blockingReason: '当前瓶颈子料：通用贴纸',
      sharedRequirements: [
        {
          materialId: 'mat-4',
          materialName: '通用贴纸',
          requiredQty: 150,
          allocatedQty: 150,
          remainingQty: 0,
        },
      ],
    },
  ],
  sharedReceiptBatches: [
    {
      id: 'receipt-4',
      batchNo: 'RB-STICKER-001',
      materialId: 'mat-4',
      materialName: '通用贴纸',
      arrivedQty: 150,
      arrivedAt: '2026-04-27T08:00:00.000Z',
      allocatedQty: 150,
      remainingQty: 0,
    },
  ],
};
