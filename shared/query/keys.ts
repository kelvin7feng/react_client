export const queryKeys = {
  myHome: (userId?: number | null) => ['myHome', userId] as const,
  userHome: (targetUserId: number, userId?: number | null) =>
    ['userHome', targetUserId, userId] as const,
  articlePage: (articleId: number, userId?: number | null) =>
    ['articlePage', articleId, userId] as const,

  recommendations: (page: number) => ['feed', 'recommend', page] as const,
  followingArticles: (page: number) => ['feed', 'following', page] as const,
  nearbyArticles: (page: number, city: string) =>
    ['feed', 'nearby', page, city] as const,

  conversations: () => ['conversations'] as const,
  unreadCount: () => ['unreadCount'] as const,

  brands: () => ['brands'] as const,
  vehiclesByBrand: (brandId: string) => ['vehiclesByBrand', brandId] as const,
  vehiclesByPrice: (min: string, max: string) =>
    ['vehiclesByPrice', min, max] as const,
  vehicleDetail: (id: string) => ['vehicleDetail', id] as const,

  followList: (userId: number) => ['followList', userId] as const,
  basicInfo: (userId?: number | null) => ['basicInfo', userId] as const,
} as const;
