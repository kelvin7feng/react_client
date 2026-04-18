import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/query/keys';

import { fetchArticlePage, fetchMyHome, fetchUserHome } from './api';

export function useMyHome(userId?: number | null) {
  return useQuery({
    queryKey: queryKeys.myHome(userId),
    queryFn: () => fetchMyHome(userId!),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

export function useUserHome(targetUserId: number, userId?: number | null) {
  return useQuery({
    queryKey: queryKeys.userHome(targetUserId, userId),
    queryFn: () => fetchUserHome(targetUserId, userId || undefined),
    enabled: !!targetUserId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useArticlePage(articleId: number, userId?: number | null) {
  return useQuery({
    queryKey: queryKeys.articlePage(articleId, userId),
    queryFn: () => fetchArticlePage(articleId, userId || undefined),
    enabled: !!articleId,
    staleTime: 5 * 60 * 1000,
  });
}
