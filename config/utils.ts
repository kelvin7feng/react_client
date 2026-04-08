import { Router } from 'expo-router';

/**
 * 数字缩写显示：>=10000 用"万"单位，保留 1 位小数
 * 例：9999 → "9999"，10000 → "1.0万"，15000 → "1.5万"，123456 → "12.3万"
 */
export function formatCount(n: number): string {
    if (n < 10000) return String(n);
    return (n / 10000).toFixed(1) + '万';
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
