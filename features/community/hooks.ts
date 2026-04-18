import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/query/keys';

import {
  fetchFollowingArticles,
  fetchNearbyArticles,
  fetchRecommendations,
} from './api';

export function useRecommendations(page: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.recommendations(page),
    queryFn: () => fetchRecommendations(page),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useFollowingArticles(page: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.followingArticles(page),
    queryFn: () => fetchFollowingArticles(page),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useNearbyArticles(page: number, city: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.nearbyArticles(page, city),
    queryFn: () => fetchNearbyArticles(page, city),
    enabled: enabled && !!city,
    staleTime: 2 * 60 * 1000,
  });
}
