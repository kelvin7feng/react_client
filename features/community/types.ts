export type ArticleFeedItem = {
  id: number;
  title: string;
  image?: string;
  author?: string;
  likes: number;
  liked: boolean;
  [key: string]: unknown;
};

export type ArticleImage = {
  id: number;
  article_id?: number;
  image_url: string;
  image_order?: number;
};

export type ArticleDetail = {
  id: number;
  title: string;
  content: string;
  topic?: string;
  author_id: number;
  published_time?: string;
  location_province?: string;
  location_city?: string;
  location_district?: string;
  location_address?: string;
  like_count: number;
  favorite_count: number;
  comment_count: number;
  view_count: number;
  author_name?: string;
  author_avatar?: string;
  images: ArticleImage[];
  liked: boolean;
  favorited: boolean;
  followed: boolean;
  [key: string]: unknown;
};

export type CommentItem = {
  id: number;
  article_id: number;
  author_id: number;
  parent_id?: number | null;
  replied_user_id?: number | null;
  content: string;
  like_count: number;
  liked: boolean;
  child_comment_count: number;
  created_time?: string;
  author_name?: string;
  author_avatar?: string;
  replied_username?: string;
  children?: CommentItem[];
  _expanded?: boolean;
  [key: string]: unknown;
};

export type UserCommentItem = {
  id: number;
  article_id: number;
  content: string;
  created_time?: string;
  article_title?: string;
  article_image?: string;
};
