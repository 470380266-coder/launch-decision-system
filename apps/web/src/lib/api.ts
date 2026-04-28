import { mockOperations, mockProductDetail, mockProducts } from './mock-data';
import {
  AllocationPayload,
  AuthUser,
  BatchStatusPayload,
  LoginResponse,
  OperationBootstrap,
  ProductDetail,
  ProductListItem,
  ReceiptPayload,
} from './types';

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.API_BASE_URL ??
  'http://localhost:3001/api';

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return fallback;
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export async function getProducts(): Promise<ProductListItem[]> {
  return safeFetch('/products', mockProducts);
}

export async function getProductDetail(id: string): Promise<ProductDetail> {
  return safeFetch(`/products/${id}`, mockProductDetail);
}

export async function getOperationsBootstrap(): Promise<OperationBootstrap> {
  return safeFetch('/operations/bootstrap', mockOperations);
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
    throw new Error(text || 'Request failed');
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
    throw new Error(text || 'Request failed');
  }

  return (await response.json()) as TOutput;
}

export function createReceipt(payload: ReceiptPayload, token: string) {
  return postJson('/operations/receipts', payload, token);
}

export function createAllocation(payload: AllocationPayload, token: string) {
  return postJson('/operations/allocations', payload, token);
}

export function updateBatchStatus(
  batchId: string,
  payload: BatchStatusPayload,
  token: string,
) {
  return patchJson(`/operations/production-batches/${batchId}/status`, payload, token);
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
