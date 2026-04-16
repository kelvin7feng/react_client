import { API_ENDPOINTS } from '@/config/api';
import { ApiError, getJson, getRawJson, requestJson } from '@/shared/http/client';

import type { ArticleDetail, ArticleFeedItem, CommentItem, UserCommentItem } from './types';

async function unwrapData<T>(request: Promise<{ code: number; msg?: string; data: T }>) {
  const response = await request;
  if (response.code !== 0) {
    throw new ApiError(response.msg || '请求失败', 200, response.code, response);
  }
  return response.data;
}

export function fetchRecommendations(page = 1, authorId?: number) {
  return getRawJson<ArticleFeedItem[]>(API_ENDPOINTS.RECOMMENDATIONS, {
    page,
    author_id: authorId,
  });
}

export function fetchFollowingArticles(page = 1) {
  return getRawJson<ArticleFeedItem[]>(API_ENDPOINTS.FOLLOWING_ARTICLES, {
    page,
  });
}

export function fetchNearbyArticles(page = 1, city?: string) {
  return getRawJson<ArticleFeedItem[]>(API_ENDPOINTS.NEARBY_ARTICLES, {
    page,
    city,
  });
}

export function fetchArticleDetail(articleId: number) {
  return unwrapData<ArticleDetail>(
    getJson(API_ENDPOINTS.GET_ARTICLE_DETAIL, {
      article_id: articleId,
    })
  );
}

export function fetchComments(articleId: number, page = 1) {
  return unwrapData<CommentItem[]>(
    getJson(API_ENDPOINTS.GET_COMMENTS, {
      article_id: articleId,
      page,
    })
  );
}

export function fetchChildComments(parentId: number, page = 1) {
  return unwrapData<CommentItem[]>(
    getJson(API_ENDPOINTS.GET_CHILD_COMMENTS, {
      parent_id: parentId,
      page,
    })
  );
}

export function createComment(input: {
  articleId: number;
  content: string;
  parentId?: number;
  repliedUserId?: number;
}) {
  return unwrapData<{ comment_id: number }>(
    requestJson(API_ENDPOINTS.CREATE_COMMENT, {
      method: 'POST',
      body: JSON.stringify({
        article_id: input.articleId,
        content: input.content,
        parent_id: input.parentId,
        replied_user_id: input.repliedUserId,
      }),
    })
  );
}

export function toggleArticleLike(articleId: number) {
  return unwrapData<{ liked: boolean }>(
    requestJson(API_ENDPOINTS.TOGGLE_LIKE, {
      method: 'POST',
      body: JSON.stringify({
        article_id: articleId,
      }),
    })
  );
}

export function toggleArticleFavorite(articleId: number) {
  return unwrapData<{ favorited: boolean }>(
    requestJson(API_ENDPOINTS.TOGGLE_FAVORITE, {
      method: 'POST',
      body: JSON.stringify({
        article_id: articleId,
      }),
    })
  );
}

export function toggleCommentLike(commentId: number) {
  return unwrapData<{ liked: boolean }>(
    requestJson(API_ENDPOINTS.TOGGLE_COMMENT_LIKE, {
      method: 'POST',
      body: JSON.stringify({
        comment_id: commentId,
      }),
    })
  );
}

export function fetchMyFavorites(page = 1) {
  return unwrapData<ArticleFeedItem[]>(
    getJson(API_ENDPOINTS.MY_FAVORITES, {
      page,
    })
  );
}

export function fetchMyLiked(page = 1) {
  return unwrapData<ArticleFeedItem[]>(
    getJson(API_ENDPOINTS.MY_LIKED, {
      page,
    })
  );
}

export function fetchMyViewed(page = 1) {
  return unwrapData<ArticleFeedItem[]>(
    getJson(API_ENDPOINTS.MY_VIEWED, {
      page,
    })
  );
}

export function fetchMyComments(page = 1) {
  return unwrapData<UserCommentItem[]>(
    getJson(API_ENDPOINTS.MY_COMMENTS, {
      page,
    })
  );
}

export function publishArticle(formData: FormData) {
  return unwrapData<{ article_id: number }>(
    requestJson(API_ENDPOINTS.PUBLISH_ARTICLE, {
      method: 'POST',
      body: formData,
    })
  );
}
