import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/query/keys';

import { fetchConversations } from './api';

export function useConversations(enabled = true) {
  return useQuery({
    queryKey: queryKeys.conversations(),
    queryFn: () => fetchConversations(1),
    enabled,
    staleTime: 30 * 1000,
  });
}
