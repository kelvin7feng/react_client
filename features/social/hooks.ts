import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/query/keys';

import { fetchFollowers, fetchFollowing, fetchMutualFollows } from './api';

export function useFollowList(userId: number | null | undefined) {
  return useQuery({
    queryKey: queryKeys.followList(userId!),
    queryFn: async () => {
      const [mutual, following, followers] = await Promise.allSettled([
        fetchMutualFollows(userId!, 1),
        fetchFollowing(userId!, 1),
        fetchFollowers(userId!, 1, userId!),
      ]);
      return {
        mutual: mutual.status === 'fulfilled' ? mutual.value || [] : [],
        following: following.status === 'fulfilled' ? following.value || [] : [],
        followers: followers.status === 'fulfilled' ? followers.value || [] : [],
      };
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}
