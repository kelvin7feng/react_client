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
