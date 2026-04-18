import { Router } from 'expo-router';
import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/query/keys';

/**
 * 数字缩写显示：>=10000 用"万"单位，保留 1 位小数
 * 例：9999 → "9999"，10000 → "1.0万"，15000 → "1.5万"，123456 → "12.3万"
 */
export function formatCount(n: number): string {
    if (n < 10000) return String(n);
    return (n / 10000).toFixed(1) + '万';
}

export type CardRect = { x: number; y: number; width: number; height: number };

let _lastCardRect: CardRect | null = null;

export function setLastCardRect(rect: CardRect) {
    _lastCardRect = rect;
}

export function getLastCardRect(): CardRect | null {
    const rect = _lastCardRect;
    _lastCardRect = null;
    return rect;
}

/** 点击头像/用户名时统一跳转：自己→"我的"tab，他人→个人主页 */
export function navigateToUserProfile(router: Router, targetUserId: number, currentUserId: number | null) {
    if (!targetUserId) return;
    if (targetUserId === currentUserId) {
        router.push('/(tabs)/my' as any);
    } else {
        router.push(`/user/${targetUserId}` as any);
    }
}

/**
 * 从 feed 卡片点击打开文章：先用卡片数据预填充缓存再导航，
 * 使文章页瞬间展示内容，后台静默加载完整数据。
 */
export function navigateToArticle(
    router: Router,
    queryClient: QueryClient,
    feedItem: Record<string, any>,
    userId?: number | null,
) {
    const articleId = feedItem.id as number;
    const key = queryKeys.articlePage(articleId, userId);

    if (!queryClient.getQueryData(key)) {
        queryClient.setQueryData(key, {
            article: {
                id: articleId,
                title: feedItem.title || '',
                content: feedItem.content || '',
                author_id: feedItem.author_id || 0,
                author_name: feedItem.author || feedItem.author_name || '',
                author_avatar: feedItem.author_avatar || '',
                images: feedItem.image
                    ? [{ id: 0, image_url: feedItem.image }]
                    : (feedItem.images || []),
                like_count: feedItem.likes ?? feedItem.like_count ?? 0,
                favorite_count: feedItem.favorite_count || 0,
                comment_count: feedItem.comment_count || 0,
                view_count: feedItem.view_count || 0,
                liked: !!feedItem.liked,
                favorited: !!feedItem.favorited,
                followed: !!feedItem.followed,
                topic: feedItem.topic || '',
                published_time: feedItem.published_time || '',
                location_city: feedItem.location_city || '',
                location_district: feedItem.location_district || '',
            },
            comments: [],
        });
        queryClient.invalidateQueries({ queryKey: key });
    }

    router.push(`/article/${articleId}`);
}
