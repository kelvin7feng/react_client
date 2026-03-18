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
} as const;

export type LikeChangedPayload = {
  articleId: number;
  liked: boolean;
  likeCount: number;
};
