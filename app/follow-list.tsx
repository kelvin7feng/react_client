import { useState, useEffect, useCallback } from 'react';
import {
    Text,
    View,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    Platform,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchFollowers, fetchFollowing, fetchMutualFollows, toggleFollow } from '@/features/social/api';
import type { SocialUser } from '@/features/social/types';
import { EventBus, Events } from '@/config/events';
import { Colors, Spacing, FontSize } from '../config/styles';
import { useAuth } from '../config/auth';
import { navigateToUserProfile } from '../config/utils';
import { RemoteImage } from '../components/RemoteImage';
import { SwipeTabView } from '../components/SwipeTabView';

const TAB_KEYS = ['mutual', 'following', 'followers'] as const;
type TabKey = typeof TAB_KEYS[number];

const TABS = [
    { key: 'mutual', label: '互相关注' },
    { key: 'following', label: '关注' },
    { key: 'followers', label: '粉丝' },
];

const UserListItem = ({
    item,
    onToggleFollow,
    isLoading,
    onUserPress,
}: {
    item: SocialUser;
    onToggleFollow: (user: SocialUser) => void;
    isLoading: boolean;
    onUserPress: (userId: number) => void;
}) => (
    <View style={styles.userItem}>
        <TouchableOpacity onPress={() => onUserPress(item.id)} activeOpacity={0.7}>
            <RemoteImage uri={item.avatar || 'https://picsum.photos/200/200?random=1'} style={styles.userAvatar} contentFit="cover" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.userInfo} onPress={() => onUserPress(item.id)} activeOpacity={0.7}>
            <Text style={styles.userName} numberOfLines={1}>{item.username}</Text>
            <Text style={styles.userSignature} numberOfLines={1}>{item.signature || '暂无签名'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
            style={[styles.followBtn, item.is_followed ? styles.followedBtn : styles.unfollowedBtn]}
            onPress={() => onToggleFollow(item)}
            disabled={isLoading}
            activeOpacity={0.7}
        >
            {isLoading ? (
                <ActivityIndicator size="small" color={item.is_followed ? Colors.textTertiary : Colors.white} />
            ) : (
                <Text style={[styles.followBtnText, item.is_followed ? styles.followedBtnText : styles.unfollowedBtnText]}>
                    {item.is_followed ? '已关注' : '关注'}
                </Text>
            )}
        </TouchableOpacity>
    </View>
);

const TabPage = ({
    items,
    loading,
    emptyText,
    onToggleFollow,
    followLoading,
    onUserPress,
}: {
    items: SocialUser[];
    loading: boolean;
    emptyText: string;
    onToggleFollow: (user: SocialUser) => void;
    followLoading: Record<number, boolean>;
    onUserPress: (userId: number) => void;
}) => (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {loading ? (
            <View style={styles.pageLoadingContainer}>
                <ActivityIndicator size="small" color={Colors.textTertiary} />
            </View>
        ) : items.length === 0 ? (
            <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color={Colors.borderDark} />
                <Text style={styles.emptyText}>{emptyText}</Text>
            </View>
        ) : (
            items.map((item) => (
                <UserListItem
                    key={item.id}
                    item={item}
                    onToggleFollow={onToggleFollow}
                    isLoading={!!followLoading[item.id]}
                    onUserPress={onUserPress}
                />
            ))
        )}
    </ScrollView>
);

export default function FollowListScreen() {
    const router = useRouter();
    const { userId } = useAuth();
    const params = useLocalSearchParams<{ tab?: string }>();
    const initialIndex = params.tab === 'followers' ? 2 : params.tab === 'mutual' ? 0 : 1;

    const [mutualList, setMutualList] = useState<SocialUser[]>([]);
    const [followingList, setFollowingList] = useState<SocialUser[]>([]);
    const [followersList, setFollowersList] = useState<SocialUser[]>([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [followLoading, setFollowLoading] = useState<Record<number, boolean>>({});

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        const fetchAll = async () => {
            setInitialLoading(true);
            const [mutualRes, followingRes, followersRes] = await Promise.allSettled([
                fetchMutualFollows(Number(userId), 1),
                fetchFollowing(Number(userId), 1),
                fetchFollowers(Number(userId), 1, Number(userId)),
            ]);
            if (cancelled) return;
            if (mutualRes.status === 'fulfilled') setMutualList(mutualRes.value || []);
            if (followingRes.status === 'fulfilled') setFollowingList(followingRes.value || []);
            if (followersRes.status === 'fulfilled') setFollowersList(followersRes.value || []);
            setInitialLoading(false);
        };
        fetchAll();
        return () => { cancelled = true; };
    }, [userId]);

    const handleToggleFollow = useCallback(async (targetUser: SocialUser) => {
        if (!userId || followLoading[targetUser.id]) return;
        setFollowLoading(prev => ({ ...prev, [targetUser.id]: true }));
        try {
            const result = await toggleFollow(targetUser.id, Number(userId));
            const newFollowed = result.followed;

            setFollowersList(prev =>
                prev.map(u => u.id === targetUser.id ? { ...u, is_followed: newFollowed } : u)
            );

            if (newFollowed) {
                setFollowingList(prev => {
                    const nextUser = { ...targetUser, is_followed: true };
                    const exists = prev.some(u => u.id === targetUser.id);
                    return exists ? prev.map(u => u.id === targetUser.id ? nextUser : u) : [nextUser, ...prev];
                });

                if (followersList.some(u => u.id === targetUser.id)) {
                    setMutualList(prev => {
                        const nextUser = { ...targetUser, is_followed: true };
                        const exists = prev.some(u => u.id === targetUser.id);
                        return exists ? prev.map(u => u.id === targetUser.id ? nextUser : u) : [nextUser, ...prev];
                    });
                }
            } else {
                setFollowingList(prev => prev.filter(u => u.id !== targetUser.id));
                setMutualList(prev => prev.filter(u => u.id !== targetUser.id));
            }

            EventBus.emit(Events.FOLLOW_CHANGED, { userId: targetUser.id, followed: newFollowed });
        } catch {} finally {
            setFollowLoading(prev => ({ ...prev, [targetUser.id]: false }));
        }
    }, [userId, followLoading, followersList]);

    const handleUserPress = useCallback((targetUserId: number) => {
        navigateToUserProfile(router, targetUserId, userId ?? null);
    }, [router, userId]);

    const tabData: Record<TabKey, { items: SocialUser[]; emptyText: string }> = {
        mutual: { items: mutualList, emptyText: '暂无互相关注' },
        following: { items: followingList, emptyText: '暂无关注' },
        followers: { items: followersList, emptyText: '暂无粉丝' },
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <SwipeTabView
                tabs={TABS}
                initialIndex={initialIndex}
                tabBarStyle={{ flex: 1 }}
                renderHeader={(tabBar) => (
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                        </TouchableOpacity>
                        {tabBar}
                        <View style={styles.backBtn} />
                    </View>
                )}
            >
                {TAB_KEYS.map((key) => (
                    <TabPage
                        key={key}
                        items={tabData[key].items}
                        loading={initialLoading}
                        emptyText={tabData[key].emptyText}
                        onToggleFollow={handleToggleFollow}
                        followLoading={followLoading}
                        onUserPress={handleUserPress}
                    />
                ))}
            </SwipeTabView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.backgroundWhite,
        paddingTop: Platform.OS === 'android' ? 25 : 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.border,
    },
    backBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pageLoadingContainer: {
        paddingVertical: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.border,
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.backgroundGray,
    },
    userInfo: {
        flex: 1,
        marginLeft: Spacing.md,
        justifyContent: 'center',
    },
    userName: {
        fontSize: FontSize.md,
        fontWeight: '500',
        color: Colors.textPrimary,
        marginBottom: 2,
    },
    userSignature: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
    },
    followBtn: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: 16,
        minWidth: 72,
        alignItems: 'center',
        justifyContent: 'center',
    },
    unfollowedBtn: {
        backgroundColor: Colors.primary,
    },
    followedBtn: {
        backgroundColor: Colors.backgroundGray,
    },
    followBtnText: {
        fontSize: FontSize.sm,
        fontWeight: '500',
    },
    unfollowedBtnText: {
        color: Colors.white,
    },
    followedBtnText: {
        color: Colors.textSecondary,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
    },
    emptyText: {
        marginTop: Spacing.md,
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
    },
});
