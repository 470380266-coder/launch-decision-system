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
  pendingBatches: Array<{
    id: string;
    batchNo: string;
    productId: string;
    productName: string;
    status: 'PENDING' | 'PAUSED' | 'COMPLETED';
    plannedQty: number;
    predictedLaunchDate: string | null;
    blockingReason: string | null;
    sharedRequirements: Array<{
      materialId: string;
      materialName: string;
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

export type AllocationPayload = {
  receiptBatchId: string;
  productionBatchId: string;
  allocatedQty: number;
  note?: string;
};

export type BatchStatusPayload = {
  batchStatus: 'PENDING' | 'PAUSED' | 'COMPLETED';
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
