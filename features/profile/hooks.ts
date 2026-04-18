import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/query/keys';

import { fetchBasicInfo } from './api';

export function useBasicInfo(userId?: number | null) {
  return useQuery({
    queryKey: queryKeys.basicInfo(userId),
    queryFn: () => fetchBasicInfo(userId || undefined),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}
