import type { ArticleDetail, ArticleFeedItem, CommentItem, UserCommentItem } from '@/features/community/types';

export type BffUserSummary = {
  id: number;
  username: string;
  email?: string;
  avatar?: string;
  signature?: string;
  birthday?: string;
  gender?: number;
};

export type BffUserStats = {
  following_count: number;
  followers_count: number;
  likes_received: number;
  favorites_received: number;
};

export type MyHomePayload = {
  user: BffUserSummary;
  stats: BffUserStats;
  notes: ArticleFeedItem[];
  comments: UserCommentItem[];
  favorites: ArticleFeedItem[];
  liked: ArticleFeedItem[];
  viewed: ArticleFeedItem[];
};

export type UserHomePayload = {
  user: BffUserSummary;
  stats: BffUserStats;
  notes: ArticleFeedItem[];
  followed: boolean;
};

export type ArticlePagePayload = {
  article: ArticleDetail;
  comments: CommentItem[];
};
