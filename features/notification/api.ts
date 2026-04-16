import { API_ENDPOINTS } from '@/config/api';
import { ApiError, getJson } from '@/shared/http/client';

export type UnreadCountSummary = {
  count: number;
  likes: number;
  follows: number;
  comments: number;
};

async function unwrapData<T>(request: Promise<{ code: number; msg?: string; data: T }>) {
  const response = await request;
  if (response.code !== 0) {
    throw new ApiError(response.msg || '请求失败', 200, response.code, response);
  }
  return response.data;
}

export function fetchUnreadCount() {
  return unwrapData<UnreadCountSummary>(
    getJson(API_ENDPOINTS.UNREAD_COUNT)
  );
}
