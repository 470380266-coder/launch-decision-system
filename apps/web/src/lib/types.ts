export type ProductState =
  | 'LAUNCHABLE'
  | 'SCHEDULABLE'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'TARGET_SHORTFALL'
  | 'SHORT_CLOSED';

export type ProductListItem = {
  id: string;
  code: string;
  name: string;
  minStartQty: number;
  standardProductionDays: number;
  bufferDays: number;
  status: ProductState;
  launchableQtyNow: number;
  shortTermIncrementQty: number;
  roundLaunchQty: number;
  allocatedLaunchQty: number;
  remainingAllocatableQty: number;
  nextLaunchDate: string | null;
  reasonSummary: string;
};

export type ProductDetail = {
  id: string;
  code: string;
  name: string;
  state: ProductState;
  launchableQtyNow: number;
  shortTermIncrementQty: number;
  roundLaunchQty: number;
  allocatedLaunchQty: number;
  remainingAllocatableQty: number;
  nextLaunchDate: string | null;
  reasonSummary: string;
  bom: {
    version: string;
    effectiveFrom: string;
    items: Array<{
      id: string;
      materialCode: string;
      materialName: string;
      unitUsage: number;
      isSharedMaterial: boolean;
    }>;
  } | null;
  productionBatches: Array<{
    id: string;
    batchNo: string;
    plannedQty: number;
    status: string;
    predictedStartDate: string | null;
    predictedFinishDate: string | null;
    predictedLaunchDate: string | null;
    blockingReason: string | null;
    sharedAllocations: Array<{
      id: string;
      materialName: string;
      allocatedQty: number;
      arrivedAt: string;
    }>;
    actual: {
      startAt: string | null;
      finishAt: string | null;
      launchAt: string | null;
      launchQty: number | null;
    } | null;
  }>;
  blockedBatches: Array<{
    id: string;
    batchNo: string;
    blockingReason: string | null;
    predictedLaunchDate: string | null;
  }>;
};

export type OperationBootstrap = {
  materials: Array<{
    id: string;
    code: string;
    name: string;
    unit: string;
  }>;
  products: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  purchasers: Array<{
    id: string;
    name: string;
    username: string;
  }>;
  admins: Array<{
    id: string;
    name: string;
    username: string;
  }>;
  activeBoms: Array<{
    id: string;
    productId: string;
    productCode: string;
    productName: string;
    versionNo: string;
    effectiveFrom: string;
    remark: string | null;
    items: Array<{
      id: string;
      materialId: string;
      materialCode: string;
      materialName: string;
      materialSpec?: string | null;
      materialUnit?: string;
      unitUsage: number;
      isSharedMaterial: boolean;
    }>;
  }>;
  bomVersions: Array<{
    id: string;
    productId: string;
    productCode: string;
    productName: string;
    versionNo: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    isActive: boolean;
    remark: string | null;
    itemCount: number;
    items: Array<{
      id: string;
      materialId: string;
      materialCode: string;
      materialName: string;
      materialSpec?: string | null;
      materialUnit?: string;
      unitUsage: number;
      isSharedMaterial: boolean;
    }>;
  }>;
  stockingRequests: Array<{
    id: string;
    requestNo: string;
    sourceStockingRequestId: string | null;
    productId: string;
    productName: string;
    targetFinishedQty: number;
    bomVersionId: string;
    bomVersionNo: string;
    status:
      | 'PENDING_FOLLOW_UP'
      | 'IN_PROGRESS'
      | 'READY_TO_BATCH'
      | 'BATCH_CREATED'
      | 'ALLOCATED'
      | 'TARGET_SHORTFALL_ALLOCATED'
      | 'COMPLETED'
      | 'SHORT_CLOSED'
      | 'CANCELLED';
    totalMaterialCount: number;
    followedMaterialCount: number;
    arrivedMaterialCount: number;
    currentMinKitQty: number;
    minStartQty: number;
    criticalGap: string;
    requestedAt: string;
    generatedBatchCount: number;
    roundLaunchQty: number;
    allocatedLaunchQty: number;
    remainingAllocatableQty: number;
    targetGapQty: number;
    restockedQty: number;
    remainingRestockGapQty: number;
    terminatedReason: string | null;
    terminatedAt: string | null;
    launchAllocations: Array<{
      id: string;
      allocationTarget: string;
      allocatedQty: number;
      allocatedAt: string;
      allocatedByName: string;
      note: string | null;
    }>;
    tracks: Array<{
      id: string;
      materialId: string;
      materialName: string;
      materialCode: string;
      materialUnit: string;
      requiredQty: number;
      actualOrderQty: number;
      isPartialPurchase: boolean;
      partialPurchaseReason: string | null;
      arrivedQty: number;
      gapQty: number;
      orderStatus: 'NOT_ORDERED' | 'ORDERED' | 'PARTIAL' | 'COMPLETED';
      productionStatus:
        | 'NOT_STARTED'
        | 'IN_PRODUCTION'
        | 'READY_TO_SHIP'
        | 'SHIPPED'
        | 'ARRIVED';
      expectedShipAt: string | null;
      expectedArriveAt: string | null;
      note: string | null;
      isSharedMaterial: boolean;
    }>;
  }>;
  procurementTracks: Array<{
    id: string;
    productId: string;
    productCode: string;
    productName: string;
    productSpec?: string | null;
    productUnit?: string;
    materialId: string;
    materialCode: string;
    materialName: string;
    materialSpec?: string | null;
    materialUnit?: string;
    purchaserName: string;
    supplier: string | null;
    purchaseOrderNo: string | null;
    requiredQty: number;
    orderedQty: number;
    actualOrderQty: number;
    isPartialPurchase: boolean;
    partialPurchaseReason: string | null;
    arrivedQty: number;
    orderStatus: 'NOT_ORDERED' | 'ORDERED' | 'PARTIAL' | 'COMPLETED';
    productionStatus:
      | 'NOT_STARTED'
      | 'IN_PRODUCTION'
      | 'READY_TO_SHIP'
      | 'SHIPPED'
      | 'ARRIVED';
    orderedAt: string | null;
    expectedShipAt: string | null;
    inTransitAt: string | null;
    transitDays: number | null;
    expectedArriveAt: string | null;
    actualArriveAt: string | null;
    receiptBatchNo: string | null;
    todoNote: string | null;
    nextFollowUpAt: string | null;
    exceptionNote: string | null;
    note: string | null;
    stockingRequestId: string | null;
    stockingRequestNo: string | null;
    bomVersionId: string | null;
    bomVersionNo: string | null;
    receiptBatchId: string | null;
  }>;
  pendingBatches: Array<{
    id: string;
    batchNo: string;
    productId: string;
    productName: string;
    stockingRequestId: string | null;
    stockingRequestNo: string | null;
    status: 'PENDING' | 'PAUSED' | 'COMPLETED';
    plannedQty: number;
    predictedLaunchDate: string | null;
    blockingReason: string | null;
    actual: {
      startAt: string | null;
      finishAt: string | null;
      launchAt: string | null;
      launchQty: number | null;
    } | null;
    sharedRequirements: Array<{
      materialId: string;
      materialName: string;
      isSharedMaterial: boolean;
      requiredQty: number;
      allocatedQty: number;
      remainingQty: number;
    }>;
  }>;
  sharedReceiptBatches: Array<{
    id: string;
    batchNo: string;
    materialId: string;
    materialName: string;
    arrivedQty: number;
    arrivedAt: string;
    allocatedQty: number;
    remainingQty: number;
  }>;
};

export type ReceiptPayload = {
  materialId: string;
  receiptBatchNo: string;
  arrivedQty: number;
  arrivedAt: string;
  sourceType: string;
  note?: string;
  productId?: string;
};

export type ProductPayload = {
  productCode: string;
  productName: string;
  productSpec?: string;
  unit: string;
  minStartQty: number;
  standardProductionDays: number;
  bufferDays: number;
  shortWindowDays?: number;
};

export type MaterialPayload = {
  materialCode: string;
  materialName: string;
  materialSpec?: string;
  unit: string;
};

export type ProcurementTrackPayload = {
  productId: string;
  materialId: string;
  supplier?: string;
  purchaseOrderNo?: string;
  requiredQty: number;
  orderedQty: number;
  orderedAt?: string;
  expectedShipAt?: string;
  transitDays?: number;
  expectedArriveAt?: string;
  nextFollowUpAt?: string;
  todoNote?: string;
  exceptionNote?: string;
  note?: string;
};

export type StockingRequestPayload = {
  productId: string;
  targetFinishedQty: number;
  selectedBomItemIds: string[];
  remark?: string;
  sourceStockingRequestId?: string;
};

export type ProcurementTrackUpdatePayload = {
  purchaseOrderNo?: string | null;
  orderedQty?: number;
  actualOrderQty?: number;
  partialPurchaseReason?: string | null;
  orderedAt?: string | null;
  orderStatus?: 'NOT_ORDERED' | 'ORDERED' | 'PARTIAL' | 'COMPLETED';
  productionStatus?:
    | 'NOT_STARTED'
    | 'IN_PRODUCTION'
    | 'READY_TO_SHIP'
    | 'SHIPPED'
    | 'ARRIVED';
  expectedShipAt?: string | null;
  inTransitAt?: string | null;
  expectedArriveAt?: string | null;
  nextFollowUpAt?: string | null;
  todoNote?: string | null;
  note?: string | null;
};

export type ProcurementArrivalPayload = {
  receiptBatchNo: string;
  arrivedQty: number;
  arrivedAt: string;
  note?: string;
};

export type AllocationPayload = {
  receiptBatchId: string;
  productionBatchId: string;
  allocatedQty: number;
  note?: string;
};

export type LaunchAllocationPayload = {
  stockingRequestId: string;
  allocationTarget: string;
  allocatedQty: number;
  note?: string;
};

export type BomVersionPayload = {
  productId: string;
  versionNo: string;
  effectiveFrom: string;
  remark?: string;
  activate?: boolean;
  items: Array<{
    materialId: string;
    unitUsage: number;
    isSharedMaterial: boolean;
  }>;
};

export type BatchStatusPayload = {
  batchStatus: 'PENDING' | 'PAUSED' | 'COMPLETED';
};

export type BatchActualPayload = {
  actualStartAt?: string | null;
  actualFinishAt?: string | null;
  actualLaunchAt?: string | null;
  actualLaunchQty?: number | null;
};

export type AuthUser = {
  id: string;
  username: string;
  name: string;
  role: 'ADMIN' | 'PURCHASER' | 'VIEWER';
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};
