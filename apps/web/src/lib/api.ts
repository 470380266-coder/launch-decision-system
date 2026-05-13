import {
  AllocationPayload,
  AuthUser,
  BatchActualPayload,
  BatchStatusPayload,
  BomVersionPayload,
  LaunchAllocationPayload,
  LoginResponse,
  MaterialPayload,
  OperationBootstrap,
  ProductDetail,
  ProductListItem,
  ProductPayload,
  ProcurementArrivalPayload,
  ProcurementTrackPayload,
  ProcurementTrackUpdatePayload,
  ReceiptPayload,
  StockingRequestPayload,
} from './types';

function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL;
  }

  if (typeof window !== 'undefined') {
    return '/api';
  }

  return 'http://localhost:3001/api';
}

export const API_BASE = getApiBase();

async function safeFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(readErrorMessage(text) || `GET ${path} failed`);
  }

  return (await response.json()) as T;
}

export async function getProducts(): Promise<ProductListItem[]> {
  return safeFetch('/products');
}

export async function getProductDetail(id: string): Promise<ProductDetail> {
  return safeFetch(`/products/${id}`);
}

export async function getOperationsBootstrap(): Promise<OperationBootstrap> {
  return safeFetch('/operations/bootstrap');
}

async function postJson<TInput, TOutput>(
  path: string,
  payload: TInput,
  token?: string,
): Promise<TOutput> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(readErrorMessage(text) || 'Request failed');
  }

  return (await response.json()) as TOutput;
}

async function patchJson<TInput, TOutput>(
  path: string,
  payload: TInput,
  token?: string,
): Promise<TOutput> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(readErrorMessage(text) || 'Request failed');
  }

  return (await response.json()) as TOutput;
}

function readErrorMessage(text: string) {
  if (!text) {
    return '';
  }

  try {
    const parsed = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) {
      return parsed.message.join('；');
    }
    return parsed.message ?? text;
  } catch {
    return text;
  }
}

export function createReceipt(payload: ReceiptPayload, token: string) {
  return postJson('/operations/receipts', payload, token);
}

export function createProduct(payload: ProductPayload, token: string) {
  return postJson<ProductPayload, { id: string; code: string; name: string; bomVersionId: string | null }>(
    '/products',
    payload,
    token,
  );
}

export function createMaterial(payload: MaterialPayload, token: string) {
  return postJson<
    MaterialPayload,
    { id: string; code: string; name: string; spec: string | null; unit: string }
  >('/operations/materials', payload, token);
}

export function updateMaterial(materialId: string, payload: MaterialPayload, token: string) {
  return patchJson<
    MaterialPayload,
    { id: string; code: string; name: string; spec: string | null; unit: string }
  >(`/operations/materials/${materialId}`, payload, token);
}

export function createProcurementTrack(
  payload: ProcurementTrackPayload,
  token: string,
) {
  return postJson('/operations/procurement-tracks', payload, token);
}

export function createStockingRequest(payload: StockingRequestPayload, token: string) {
  return postJson<
    StockingRequestPayload,
    {
      id: string;
      requestNo: string;
      productId: string;
      bomVersionId: string;
      createdTrackCount: number;
    }
  >('/operations/stocking-requests', payload, token);
}

export function updateProcurementTrack(
  trackId: string,
  payload: ProcurementTrackUpdatePayload,
  token: string,
) {
  return patchJson(`/operations/procurement-tracks/${trackId}`, payload, token);
}

export function confirmProcurementArrival(
  trackId: string,
  payload: ProcurementArrivalPayload,
  token: string,
) {
  return postJson(`/operations/procurement-tracks/${trackId}/arrival`, payload, token);
}

export function createAllocation(payload: AllocationPayload, token: string) {
  return postJson('/operations/allocations', payload, token);
}

export function createLaunchAllocation(payload: LaunchAllocationPayload, token: string) {
  return postJson('/operations/launch-allocations', payload, token);
}

export function terminateStockingRequest(
  stockingRequestId: string,
  payload: { reason: string },
  token: string,
) {
  return patchJson(`/operations/stocking-requests/${stockingRequestId}/terminate`, payload, token);
}

export function createBomVersion(payload: BomVersionPayload, token: string) {
  return postJson('/operations/bom-versions', payload, token);
}

export function activateBomVersion(bomVersionId: string, token: string) {
  return patchJson(`/operations/bom-versions/${bomVersionId}/activate`, {}, token);
}

export function updateBatchStatus(
  batchId: string,
  payload: BatchStatusPayload,
  token: string,
) {
  return patchJson(`/operations/production-batches/${batchId}/status`, payload, token);
}

export function updateBatchActual(
  batchId: string,
  payload: BatchActualPayload,
  token: string,
) {
  return patchJson(`/operations/production-batches/${batchId}/actual`, payload, token);
}

export async function login(username: string, password: string) {
  return postJson<{ username: string; password: string }, LoginResponse>(
    '/auth/login',
    { username, password },
  );
}

export async function getCurrentUser(token: string) {
  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Unauthorized');
  }

  return (await response.json()) as AuthUser;
}

export async function getOperationsBootstrapAuthed(token: string) {
  const response = await fetch(`${API_BASE}/operations/bootstrap`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Unauthorized');
  }

  return (await response.json()) as OperationBootstrap;
}
