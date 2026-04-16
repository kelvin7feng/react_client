import { API_ENDPOINTS } from '@/config/api';
import { ApiError, getJson } from '@/shared/http/client';

import type { ArticlePagePayload, MyHomePayload, UserHomePayload } from './types';

async function unwrapData<T>(request: Promise<{ code: number; msg?: string; data: T }>) {
  const response = await request;
  if (response.code !== 0) {
    throw new ApiError(response.msg || '请求失败', 200, response.code, response);
  }
  return response.data;
}

export function fetchMyHome(userId?: number) {
  return unwrapData<MyHomePayload>(
    getJson(API_ENDPOINTS.BFF_MOBILE_ME_HOME, { user_id: userId })
  );
}

export function fetchUserHome(targetUserId: number, userId?: number) {
  return unwrapData<UserHomePayload>(
    getJson(`${API_ENDPOINTS.BFF_MOBILE_USERS}/${targetUserId}/home`, { user_id: userId })
  );
}

export function fetchArticlePage(articleId: number, userId?: number) {
  return unwrapData<ArticlePagePayload>(
    getJson(`${API_ENDPOINTS.BFF_MOBILE_ARTICLES}/${articleId}/page`, { user_id: userId })
  );
}
