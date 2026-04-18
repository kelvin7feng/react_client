import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/query/keys';

import {
  createComment,
  publishArticle,
  toggleArticleFavorite,
  toggleArticleLike,
  toggleCommentLike,
} from './api';

export function useToggleArticleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (articleId: number) => toggleArticleLike(articleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myHome'] });
      qc.invalidateQueries({ queryKey: ['articlePage'] });
    },
  });
}

export function useToggleArticleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (articleId: number) => toggleArticleFavorite(articleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myHome'] });
      qc.invalidateQueries({ queryKey: ['articlePage'] });
    },
  });
}

export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createComment>[0]) =>
      createComment(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['articlePage'] });
    },
  });
}

export function usePublishArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => publishArticle(formData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myHome'] });
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
