import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/query/keys';

import { toggleFollow } from './api';

export function useToggleFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      followingId,
      followerId,
    }: {
      followingId: number;
      followerId?: number;
    }) => toggleFollow(followingId, followerId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['followList'] });
      qc.invalidateQueries({ queryKey: ['userHome'] });
      qc.invalidateQueries({ queryKey: ['myHome'] });
    },
  });
}
