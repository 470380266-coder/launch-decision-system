export type ProductState = 'LAUNCHABLE' | 'SCHEDULABLE' | 'BLOCKED';

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
      unitUsage: number;
      isSharedMaterial: boolean;
    }>;
  }>;
  procurementTracks: Array<{
    id: string;
    productId: string;
    productCode: string;
    productName: string;
    materialId: string;
    materialCode: string;
    materialName: string;
    purchaserName: string;
    supplier: string | null;
    purchaseOrderNo: string | null;
    requiredQty: number;
    orderedQty: number;
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
    receiptBatchId: string | null;
  }>;
  pendingBatches: Array<{
    id: string;
    batchNo: string;
    productId: string;
    productName: string;
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

export type ProcurementTrackUpdatePayload = {
  orderedQty?: number;
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
