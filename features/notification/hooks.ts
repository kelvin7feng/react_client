import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/query/keys';

import { fetchUnreadCount } from './api';

export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: queryKeys.unreadCount(),
    queryFn: fetchUnreadCount,
    enabled,
    staleTime: 30 * 1000,
  });
}
