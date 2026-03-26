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
import { buildApiUrl, API_ENDPOINTS, API_BASE_URL } from '../config/api';
import { Colors, Spacing, FontSize } from '../config/styles';
import { useAuth } from '../config/auth';
import { RemoteImage } from '../components/RemoteImage';
import { SwipeTabView } from '../components/SwipeTabView';

const TAB_KEYS = ['mutual', 'following', 'followers'] as const;
type TabKey = typeof TAB_KEYS[number];

const TABS = [
    { key: 'mutual', label: '互相关注' },
    { key: 'following', label: '关注' },
    { key: 'followers', label: '粉丝' },
];

interface UserItem {
    id: number;
    username: string;
    avatar: string;
    signature: string;
    is_followed: boolean;
}

const UserListItem = ({
    item,
    onToggleFollow,
    isLoading,
}: {
    item: UserItem;
    onToggleFollow: (user: UserItem) => void;
    isLoading: boolean;
}) => (
    <View style={styles.userItem}>
        <RemoteImage uri={item.avatar || 'https://picsum.photos/200/200?random=1'} style={styles.userAvatar} contentFit="cover" />
        <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>{item.username}</Text>
            <Text style={styles.userSignature} numberOfLines={1}>{item.signature || '暂无签名'}</Text>
        </View>
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
}: {
    items: UserItem[];
    loading: boolean;
    emptyText: string;
    onToggleFollow: (user: UserItem) => void;
    followLoading: Record<number, boolean>;
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

    const [mutualList, setMutualList] = useState<UserItem[]>([]);
    const [followingList, setFollowingList] = useState<UserItem[]>([]);
    const [followersList, setFollowersList] = useState<UserItem[]>([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [followLoading, setFollowLoading] = useState<Record<number, boolean>>({});

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        const fetchAll = async () => {
            const [mutualRes, followingRes, followersRes] = await Promise.allSettled([
                fetch(buildApiUrl(API_ENDPOINTS.MUTUAL_FOLLOWS, { user_id: userId, page: 1 })).then(r => r.json()),
                fetch(buildApiUrl(API_ENDPOINTS.FOLLOWING, { user_id: userId, page: 1 })).then(r => r.json()),
                fetch(buildApiUrl(API_ENDPOINTS.FOLLOWERS, { user_id: userId, current_user_id: userId, page: 1 })).then(r => r.json()),
            ]);
            if (cancelled) return;
            if (mutualRes.status === 'fulfilled' && mutualRes.value.code === 0) setMutualList(mutualRes.value.data || []);
            if (followingRes.status === 'fulfilled' && followingRes.value.code === 0) setFollowingList(followingRes.value.data || []);
            if (followersRes.status === 'fulfilled' && followersRes.value.code === 0) setFollowersList(followersRes.value.data || []);
            setInitialLoading(false);
        };
        fetchAll();
        return () => { cancelled = true; };
    }, [userId]);

    const handleToggleFollow = useCallback(async (targetUser: UserItem) => {
        if (!userId || followLoading[targetUser.id]) return;
        setFollowLoading(prev => ({ ...prev, [targetUser.id]: true }));
        try {
            const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.TOGGLE_FOLLOW}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ follower_id: Number(userId), following_id: targetUser.id }),
            });
            const result = await res.json();
            if (result.code === 0) {
                const newFollowed = result.data.followed;
                const updateList = (list: UserItem[]) =>
                    list.map(u => u.id === targetUser.id ? { ...u, is_followed: newFollowed } : u);
                setFollowingList(updateList);
                setFollowersList(updateList);
                setMutualList(updateList);
            }
        } catch {} finally {
            setFollowLoading(prev => ({ ...prev, [targetUser.id]: false }));
        }
    }, [userId, followLoading]);

    const tabData: Record<TabKey, { items: UserItem[]; emptyText: string }> = {
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
