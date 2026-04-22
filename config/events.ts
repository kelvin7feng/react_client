type Listener = (...args: any[]) => void;

const listeners: Record<string, Set<Listener>> = {};

export const EventBus = {
  on(event: string, fn: Listener) {
    if (!listeners[event]) listeners[event] = new Set();
    listeners[event].add(fn);
    return () => { listeners[event]?.delete(fn); };
  },
  emit(event: string, ...args: any[]) {
    listeners[event]?.forEach((fn) => fn(...args));
  },
};

export const Events = {
  ARTICLE_LIKE_CHANGED: 'article:like_changed',
  ARTICLE_FAVORITE_CHANGED: 'article:favorite_changed',
  FOLLOW_CHANGED: 'user:follow_changed',
  // 点击发布时立即触发：首页可以据此把本地快照 prepend 到各 tab 列表中
  ARTICLE_PUBLISH_STARTED: 'article:publish_started',
  // 发布成功：把占位条目的 localId 替换成服务端真实 articleId
  ARTICLE_PUBLISHED: 'article:published',
  // 发布失败：按 localId 从各 tab 列表移除占位
  ARTICLE_PUBLISH_FAILED: 'article:publish_failed',
  ARTICLE_DELETED: 'article:deleted',
  ARTICLE_VISIBILITY_CHANGED: 'article:visibility_changed',
} as const;

export type LikeChangedPayload = {
  articleId: number;
  liked: boolean;
  likeCount: number;
};

export type FavoriteChangedPayload = {
  articleId: number;
  favorited: boolean;
};

export type FollowChangedPayload = {
  userId: number;
  followed: boolean;
};

/**
 * 本地发布占位条目（"乐观更新"）字段。
 * id 为客户端生成的负数临时 id，图片为本地 file:// URI。
 */
export type ArticlePublishSnapshot = {
  id: number;
  image: string;
  title: string;
  author: string;
  author_id?: number;
  likes: number;
  liked: boolean;
  pending: true;
};

export type ArticlePublishStartedPayload = {
  snapshot: ArticlePublishSnapshot;
};

export type ArticlePublishedPayload = {
  localId: number;
  articleId?: number;
};

export type ArticlePublishFailedPayload = {
  localId: number;
  message?: string;
};
