import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Text,
    View,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    ActivityIndicator,
    TouchableOpacity,
    Dimensions,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchUserHome } from '@/features/bff/api';
import { toggleArticleLike } from '@/features/community/api';
import { toggleFollow } from '@/features/social/api';
import { buildApiUrl, API_ENDPOINTS } from '../../config/api';
import { Colors, Spacing, FontSize, Shadows } from '../../config/styles';
import { EventBus, Events, LikeChangedPayload } from '../../config/events';
import { useAuth } from '../../config/auth';
import { formatCount } from '../../config/utils';
import { openChat } from '../../config/chatManager';
import { RemoteImage } from '../../components/RemoteImage';
import { WaterfallArticleCard, WaterfallTwoColumnGrid } from '../../components/WaterfallArticleCard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const GenderIcon = ({ gender }: { gender: number }) => {
    if (gender === 1) {
        return (
            <View style={[styles.genderBadge, { backgroundColor: '#E8F0FE' }]}>
                <Ionicons name="male" size={12} color="#4A90D9" />
            </View>
        );
    }
    if (gender === 2) {
        return (
            <View style={[styles.genderBadge, { backgroundColor: '#FDE8EF' }]}>
                <Ionicons name="female" size={12} color="#E84393" />
            </View>
        );
    }
    return null;
};

const StatItem = ({ count, label, onPress }: { count: number; label: string; onPress?: () => void }) => (
    <TouchableOpacity style={styles.statItem} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
        <Text style={styles.statCount}>{formatCount(count)}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
);

const EmptyTabContent = ({ label }: { label: string }) => (
    <View style={styles.emptyTab}>
        <Ionicons name="document-text-outline" size={48} color={Colors.borderDark} />
        <Text style={styles.emptyTabText}>暂无{label}内容</Text>
    </View>
);

export default function UserProfileScreen() {
    const { userId: targetId } = useLocalSearchParams<{ userId: string }>();
    const router = useRouter();
    const { userId: currentUserId, isLoggedIn } = useAuth();
    const targetUserId = Number(targetId);

    const [userData, setUserData] = useState<any>(null);
    const [userStats, setUserStats] = useState({ following_count: 0, followers_count: 0, likes_received: 0, favorites_received: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notes, setNotes] = useState<any[]>([]);
    const [notesLoading, setNotesLoading] = useState(true);
    const [followed, setFollowed] = useState(false);
    const [profileH, setProfileH] = useState(0);
    const scrollY = useRef(new Animated.Value(0)).current;

    const safeProfileH = Math.max(profileH, 1);

    const headerTranslateY = scrollY.interpolate({
        inputRange: [0, safeProfileH],
        outputRange: [0, -safeProfileH],
        extrapolate: 'clamp',
    });

    const scrollHandler = Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: false },
    );

    const applyFollowState = useCallback((nextFollowed: boolean) => {
        setFollowed(prev => {
            if (prev === nextFollowed) {
                return prev;
            }
            setUserStats(stats => ({
                ...stats,
                followers_count: nextFollowed
                    ? stats.followers_count + 1
                    : Math.max(stats.followers_count - 1, 0),
            }));
            return nextFollowed;
        });
    }, []);

    const fetchHomeData = useCallback(async () => {
        if (!targetUserId) return;
        setLoading(true);
        setNotesLoading(true);
        try {
            const result = await fetchUserHome(targetUserId, currentUserId || undefined);
            setUserData(result.user);
            setUserStats(result.stats || { following_count: 0, followers_count: 0, likes_received: 0, favorites_received: 0 });
            setNotes(result.notes || []);
            setFollowed(!!result.followed);
            setError(null);
        } catch (err: any) {
            setUserData(null);
            setError(err.message || '获取用户主页失败');
        } finally {
            setLoading(false);
            setNotesLoading(false);
        }
    }, [targetUserId, currentUserId]);

    useEffect(() => {
        fetchHomeData();
    }, [fetchHomeData]);

    useEffect(() => {
        const off = EventBus.on(Events.ARTICLE_LIKE_CHANGED, ({ articleId, liked, likeCount }: LikeChangedPayload) => {
            setNotes(prev => prev.map(item => item.id === articleId ? { ...item, likes: likeCount, liked } : item));
        });
        return off;
    }, []);

    useEffect(() => {
        const off = EventBus.on(Events.FOLLOW_CHANGED, ({ userId, followed }: { userId: number; followed: boolean }) => {
            if (userId === targetUserId) {
                applyFollowState(followed);
            }
        });
        return off;
    }, [applyFollowState, targetUserId]);

    const handleFollow = async () => {
        if (!isLoggedIn) { router.push('/login'); return; }
        const prev = followed;
        applyFollowState(!prev);
        try {
            const result = await toggleFollow(targetUserId, Number(currentUserId));
            applyFollowState(result.followed);
            EventBus.emit(Events.FOLLOW_CHANGED, { userId: targetUserId, followed: result.followed });
        } catch {
            applyFollowState(prev);
        }
    };

    const handleNoteLike = useCallback(async (article: any) => {
        if (!isLoggedIn) { router.push('/login'); return; }
        const newLiked = !article.liked;
        const newCount = newLiked ? article.likes + 1 : Math.max(article.likes - 1, 0);
        setNotes(prev => prev.map(it => it.id === article.id ? { ...it, liked: newLiked, likes: newCount } : it));
        try {
            await toggleArticleLike(article.id);
            EventBus.emit(Events.ARTICLE_LIKE_CHANGED, { articleId: article.id, liked: newLiked, likeCount: newCount } as LikeChangedPayload);
        } catch {
            setNotes(prev => prev.map(it => it.id === article.id ? { ...it, liked: article.liked, likes: article.likes } : it));
        }
    }, [isLoggedIn, currentUserId, router]);

    const handleSendMessage = useCallback(async () => {
        if (!isLoggedIn) { router.push('/login'); return; }
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATIONS, { user_id: currentUserId!, page: 1 }));
            const result = await response.json();
            if (result.code === 0) {
                const conv = (result.data || []).find((c: any) =>
                    (c.user1_id === currentUserId && c.user2_id === targetUserId) ||
                    (c.user2_id === currentUserId && c.user1_id === targetUserId)
                );
                if (conv) {
                    openChat(String(conv.id), targetUserId);
                    return;
                }
            }
        } catch {}
        openChat('new', targetUserId);
    }, [isLoggedIn, currentUserId, targetUserId, router]);

    if (loading) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>
                </View>
                <View style={styles.centerWrap}>
                    <ActivityIndicator size="small" color="gray" />
                </View>
            </SafeAreaView>
        );
    }

    if (error || !userData) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>
                </View>
                <View style={styles.centerWrap}>
                    <Ionicons name="alert-circle" size={50} color={Colors.error} />
                    <Text style={styles.errorText}>{error || '未找到用户数据'}</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.topBarTitle} numberOfLines={1}>{userData.username || '用户主页'}</Text>
                <View style={styles.backBtn} />
            </View>

            <Animated.ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
            >
                <LinearGradient
                    colors={['#ededed', '#e8e8e8', '#f0f0f0']}
                    style={styles.headerGradient}
                    onLayout={(e) => setProfileH(e.nativeEvent.layout.height)}
                >
                    <View style={styles.profileHeader}>
                        <RemoteImage
                            uri={userData.avatar || 'https://picsum.photos/200/200?random=1'}
                            style={styles.avatar}
                            contentFit="cover"
                        />
                        <View style={styles.profileInfo}>
                            <View style={styles.nameRow}>
                                <GenderIcon gender={userData.gender} />
                                <Text style={styles.name}>{userData.username || '未知用户'}</Text>
                            </View>
                            <Text style={styles.signature} numberOfLines={2}>
                                {userData.signature || '暂无个性签名'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.statsRow}>
                        <StatItem count={userStats.following_count} label="关注" />
                        <StatItem count={userStats.followers_count} label="粉丝" />
                        <StatItem count={userStats.likes_received} label="获赞" />
                        <StatItem count={userStats.favorites_received} label="收藏" />
                    </View>

                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[styles.actionBtn, followed ? styles.actionBtnSecondary : styles.actionBtnPrimary]}
                            onPress={handleFollow}
                        >
                            <Text style={[styles.actionBtnText, followed ? styles.actionBtnTextSecondary : styles.actionBtnTextPrimary]}>
                                {followed ? '已关注' : '+ 关注'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.actionBtnOutline]}
                            onPress={handleSendMessage}
                        >
                            <View style={styles.actionBtnInner}>
                                <Ionicons name="chatbubble-ellipses-outline" size={16} color={Colors.textPrimary} />
                                <Text style={[styles.actionBtnText, styles.actionBtnTextOutline]}>私信</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                <View style={styles.notesSection}>
                    <View style={styles.notesSectionHeader}>
                        <Text style={styles.notesSectionTitle}>笔记</Text>
                    </View>
                    {notesLoading ? (
                        <View style={styles.tabLoadingWrap}>
                            <ActivityIndicator size="small" color={Colors.textTertiary} />
                        </View>
                    ) : notes.length === 0 ? (
                        <EmptyTabContent label="笔记" />
                    ) : (
                        <WaterfallTwoColumnGrid
                            items={notes}
                            keyExtractor={(item: any) => String(item.id)}
                            renderItem={(item: any) => (
                                <WaterfallArticleCard
                                    item={item}
                                    onPress={(id) => router.push(`/article/${id}`)}
                                    onLike={handleNoteLike}
                                />
                            )}
                        />
                    )}
                </View>
            </Animated.ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#ededed' },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.sm,
        backgroundColor: '#ededed',
        zIndex: 20,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    topBarTitle: {
        flex: 1,
        fontSize: FontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
        textAlign: 'center',
    },
    centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { marginTop: Spacing.md, fontSize: FontSize.sm, color: Colors.textSecondary },
    headerGradient: { paddingBottom: Spacing.lg },
    profileHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xl },
    avatar: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: Colors.white, ...Shadows.large },
    profileInfo: { flex: 1, marginLeft: Spacing.lg, justifyContent: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs + 2 },
    genderBadge: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
    name: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.textPrimary },
    signature: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
    statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
    statItem: { marginRight: Spacing.xxl, alignItems: 'center' },
    statCount: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.textPrimary },
    statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
    actionRow: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.lg,
        gap: Spacing.md,
    },
    actionBtn: {
        flex: 1,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionBtnPrimary: { backgroundColor: Colors.primary },
    actionBtnSecondary: { backgroundColor: Colors.backgroundGray },
    actionBtnOutline: { backgroundColor: Colors.backgroundGray },
    actionBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    actionBtnText: { fontSize: FontSize.sm, fontWeight: '600' },
    actionBtnTextPrimary: { color: Colors.white },
    actionBtnTextSecondary: { color: Colors.textSecondary },
    actionBtnTextOutline: { color: Colors.textPrimary },
    notesSection: {
        backgroundColor: Colors.backgroundWhite,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        minHeight: SCREEN_HEIGHT * 0.5,
        paddingBottom: Spacing.xxl,
    },
    notesSectionHeader: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    notesSectionTitle: {
        fontSize: FontSize.md,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    tabLoadingWrap: { paddingVertical: 60, alignItems: 'center' },
    emptyTab: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
    emptyTabText: { marginTop: Spacing.md, fontSize: FontSize.sm, color: Colors.textTertiary },
});
