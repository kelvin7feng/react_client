import { API_ENDPOINTS } from '@/config/api';
import { ApiError, getJson, requestJson } from '@/shared/http/client';

import type { FollowStatusResult, SocialUser, ToggleFollowResult } from './types';

async function unwrapData<T>(request: Promise<{ code: number; msg?: string; data: T }>) {
  const response = await request;
  if (response.code !== 0) {
    throw new ApiError(response.msg || '请求失败', 200, response.code, response);
  }
  return response.data;
}

export function fetchFollowers(userId: number, page = 1, currentUserId?: number) {
  return unwrapData<SocialUser[]>(
    getJson(API_ENDPOINTS.FOLLOWERS, {
      user_id: userId,
      page,
      current_user_id: currentUserId,
    })
  );
}

export function fetchFollowing(userId: number, page = 1) {
  return unwrapData<SocialUser[]>(
    getJson(API_ENDPOINTS.FOLLOWING, {
      user_id: userId,
      page,
    })
  );
}

export function fetchMutualFollows(userId: number, page = 1) {
  return unwrapData<SocialUser[]>(
    getJson(API_ENDPOINTS.MUTUAL_FOLLOWS, {
      user_id: userId,
      page,
    })
  );
}

export function fetchFollowStatus(followingId: number, userId?: number) {
  return unwrapData<FollowStatusResult>(
    getJson(API_ENDPOINTS.FOLLOW_STATUS, {
      following_id: followingId,
      user_id: userId,
    })
  );
}

export function toggleFollow(followingId: number, followerId?: number) {
  return unwrapData<ToggleFollowResult>(
    requestJson(API_ENDPOINTS.TOGGLE_FOLLOW, {
      method: 'POST',
      body: JSON.stringify({
        following_id: followingId,
        follower_id: followerId,
      }),
    })
  );
}
