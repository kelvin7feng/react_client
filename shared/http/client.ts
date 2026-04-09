import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from '../config/env';

type QueryValue = string | number | boolean | null | undefined;
type Query = Record<string, QueryValue>;

export type ApiEnvelope<T> = {
  code: number;
  msg?: string;
  data: T;
  error?: string;
};

export class ApiError extends Error {
  status?: number;
  code?: number;
  payload?: unknown;

  constructor(message: string, status?: number, code?: number, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

const buildQueryString = (query?: Query) => {
  if (!query) {
    return '';
  }

  const entries = Object.entries(query).filter(([, value]) => value !== undefined && value !== null);
  if (entries.length === 0) {
    return '';
  }

  return entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
};

const buildUrl = (path: string, query?: Query) => {
  const url = `${API_BASE_URL}${path}`;
  const queryString = buildQueryString(query);
  return queryString ? `${url}?${queryString}` : url;
};

const buildHeaders = async (headers?: HeadersInit, body?: BodyInit | null) => {
  const result = new Headers(headers);
  const token = await AsyncStorage.getItem('user_token');

  if (token && !result.has('Authorization')) {
    result.set('Authorization', `Bearer ${token}`);
  }

  if (!result.has('Accept')) {
    result.set('Accept', 'application/json');
  }

  if (body && !(body instanceof FormData) && !result.has('Content-Type')) {
    result.set('Content-Type', 'application/json');
  }

  return result;
};

export async function requestJson<T>(
  path: string,
  options: RequestInit & { query?: Query } = {}
): Promise<ApiEnvelope<T>> {
  const { query, ...requestOptions } = options;
  const response = await fetch(buildUrl(path, query), {
    ...requestOptions,
    headers: await buildHeaders(requestOptions.headers, requestOptions.body ?? null),
  });

  const rawText = await response.text();
  let payload: unknown = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      throw new ApiError('响应解析失败', response.status);
    }
  }

  if (!response.ok) {
    const errorPayload = payload as Partial<ApiEnvelope<unknown>> | null;
    throw new ApiError(
      errorPayload?.msg || errorPayload?.error || `HTTP ${response.status}`,
      response.status,
      errorPayload?.code,
      payload
    );
  }

  return payload as ApiEnvelope<T>;
}

export function getJson<T>(path: string, query?: Query) {
  return requestJson<T>(path, { method: 'GET', query });
}
