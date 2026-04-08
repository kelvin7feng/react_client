import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Text,
    View,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    Platform,
    ActivityIndicator,
    TouchableOpacity,
    Dimensions,
    Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { buildApiUrl, API_ENDPOINTS, API_BASE_URL } from '../../config/api';
import { CommonStyles, Colors, Spacing, FontSize, Shadows } from '../../config/styles';
import { EventBus, Events, LikeChangedPayload } from '../../config/events';
import { useAuth } from '../../config/auth';
import { formatCount, navigateToUserProfile } from '../../config/utils';
import { RemoteImage } from '../../components/RemoteImage';
import { WaterfallArticleCard, WaterfallTwoColumnGrid } from '../../components/WaterfallArticleCard';
import { SwipeTabView } from '../../components/SwipeTabView';
import { SettingsDrawer } from '../../components/SettingsDrawer';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const TAB_ICON_SIZE = 14;
const TABS = [
    {
        key: 'notes', label: '笔记',
        renderIcon: (color: any) => <Animated.Text style={{ color }}><Ionicons name="document-text-outline" size={TAB_ICON_SIZE} /></Animated.Text>,
    },
    {
        key: 'comments', label: '评论',
        renderIcon: (color: any) => <Animated.Text style={{ color }}><Ionicons name="chatbubble-outline" size={TAB_ICON_SIZE} /></Animated.Text>,
    },
    {
        key: 'favorites', label: '收藏',
        renderIcon: (color: any) => <Animated.Text style={{ color }}><Ionicons name="star-outline" size={TAB_ICON_SIZE} /></Animated.Text>,
    },
    {
        key: 'liked', label: '赞过',
        renderIcon: (color: any) => <Animated.Text style={{ color }}><Ionicons name="heart-outline" size={TAB_ICON_SIZE} /></Animated.Text>,
    },
    {
        key: 'viewed', label: '看过',
        renderIcon: (color: any) => <Animated.Text style={{ color }}><Ionicons name="eye-outline" size={TAB_ICON_SIZE} /></Animated.Text>,
    },
];

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

const CommentListItem = ({ item, onPress }: { item: any; onPress: (id: number) => void }) => (
    <TouchableOpacity style={styles.myCommentItem} activeOpacity={0.7} onPress={() => onPress(item.article_id)}>
        <View style={styles.myCommentLeft}>
            <Text style={styles.myCommentContent} numberOfLines={2}>{item.content}</Text>
            <Text style={styles.myCommentMeta}>
                {item.article_title ? `评论了：${item.article_title}` : ''}
            </Text>
        </View>
        {item.article_image ? (
            <RemoteImage uri={item.article_image} style={styles.myCommentImage} contentFit="cover" />
        ) : null}
    </TouchableOpacity>
);

export default function MyScreen() {
    const router = useRouter();
    const { userId, isLoggedIn } = useAuth();
    const insets = useSafeAreaInsets();
    const [userData, setUserData] = useState<any>(null);
    const [userStats, setUserStats] = useState({ following_count: 0, followers_count: 0, likes_received: 0, favorites_received: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tabDataLoading, setTabDataLoading] = useState(true);

    const [myNotes, setMyNotes] = useState<any[]>([]);
    const [myFavorites, setMyFavorites] = useState<any[]>([]);
    const [myLiked, setMyLiked] = useState<any[]>([]);
    const [myViewed, setMyViewed] = useState<any[]>([]);
    const [myCommentsList, setMyCommentsList] = useState<any[]>([]);
    const [tabBarH, setTabBarH] = useState(0);
    const [profileH, setProfileH] = useState(0);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const scrollY = useRef(new Animated.Value(0)).current;
    const currentOffsetRef = useRef(0);
    const tabScrollRefs = useRef<Record<string, ScrollView | null>>({});

    const safeProfileH = Math.max(profileH, 1);
    const totalHeaderH = profileH + tabBarH;

    const headerTranslateY = scrollY.interpolate({
        inputRange: [0, safeProfileH],
        outputRange: [0, -safeProfileH],
        extrapolate: 'clamp',
    });

    const scrollHandler = Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        {
            useNativeDriver: false,
            listener: (e: any) => {
                currentOffsetRef.current = e.nativeEvent.contentOffset.y;
            },
        },
    );

    const handleMyTabChange = useCallback((key: string) => {
        if (profileH > 0 && currentOffsetRef.current >= profileH) {
            setTimeout(() => {
                tabScrollRefs.current[key]?.scrollTo({ y: profileH, animated: false });
            }, 50);
        }
    }, [profileH]);

    const fetchUserData = useCallback(async () => {
        if (!userId) return;
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.GET_BASIC_INFO, { id: userId }));
            if (!response.ok) throw new Error(`HTTP错误! 状态: ${response.status}`);
            const result = await response.json();
            if (result.code !== 0) throw new Error(result.msg || '获取用户信息失败');
            setUserData(result.data);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const fetchStats = useCallback(async () => {
        if (!userId) return;
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.USER_STATS, { user_id: userId }));
            const result = await response.json();
            if (result.code === 0) setUserStats(result.data);
        } catch {}
    }, [userId]);

    const fetchAllTabData = useCallback(async () => {
        if (!userId) return;
        const [notesRes, commentsRes, favoritesRes, likedRes, viewedRes] = await Promise.allSettled([
            fetch(buildApiUrl(API_ENDPOINTS.RECOMMENDATIONS, { page: 1, author_id: userId, user_id: userId })).then(r => r.json()),
            fetch(buildApiUrl(API_ENDPOINTS.MY_COMMENTS, { user_id: userId, page: 1 })).then(r => r.json()),
            fetch(buildApiUrl(API_ENDPOINTS.MY_FAVORITES, { user_id: userId, page: 1 })).then(r => r.json()),
            fetch(buildApiUrl(API_ENDPOINTS.MY_LIKED, { user_id: userId, page: 1 })).then(r => r.json()),
            fetch(buildApiUrl(API_ENDPOINTS.MY_VIEWED, { user_id: userId, page: 1 })).then(r => r.json()),
        ]);
        if (notesRes.status === 'fulfilled') {
            const d = notesRes.value;
            setMyNotes(Array.isArray(d) ? d : (d.data || []));
        }
        if (commentsRes.status === 'fulfilled' && commentsRes.value.code === 0) setMyCommentsList(commentsRes.value.data || []);
        if (favoritesRes.status === 'fulfilled' && favoritesRes.value.code === 0) setMyFavorites(favoritesRes.value.data || []);
        if (likedRes.status === 'fulfilled' && likedRes.value.code === 0) setMyLiked(likedRes.value.data || []);
        if (viewedRes.status === 'fulfilled' && viewedRes.value.code === 0) setMyViewed(viewedRes.value.data || []);
        setTabDataLoading(false);
    }, [userId]);

    useEffect(() => {
        if (!userId) return;
        setLoading(true);
        fetchUserData();
    }, [fetchUserData, userId]);

    useFocusEffect(useCallback(() => {
        if (!isLoggedIn) {
            router.replace('/login');
            return;
        }
        fetchUserData();
        fetchStats();
        fetchAllTabData();
    }, [isLoggedIn, userId, fetchUserData, fetchStats, fetchAllTabData]));

    const handleNoteLike = useCallback(async (article: any) => {
        const newLiked = !article.liked;
        const newCount = newLiked ? article.likes + 1 : Math.max(article.likes - 1, 0);
        setMyNotes(prev => prev.map(it => it.id === article.id ? { ...it, liked: newLiked, likes: newCount } : it));
        try {
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.TOGGLE_LIKE}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ article_id: article.id, user_id: userId }),
            });
            const result = await response.json();
            if (result.code === 0) {
                EventBus.emit(Events.ARTICLE_LIKE_CHANGED, { articleId: article.id, liked: newLiked, likeCount: newCount } as LikeChangedPayload);
            } else {
                setMyNotes(prev => prev.map(it => it.id === article.id ? { ...it, liked: article.liked, likes: article.likes } : it));
            }
        } catch {
            setMyNotes(prev => prev.map(it => it.id === article.id ? { ...it, liked: article.liked, likes: article.likes } : it));
        }
    }, [userId]);

    const handleListLike = useCallback(async (article: any, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
        const newLiked = !article.liked;
        const newCount = newLiked ? article.likes + 1 : Math.max(article.likes - 1, 0);
        setter(prev => prev.map(it => it.id === article.id ? { ...it, liked: newLiked, likes: newCount } : it));
        try {
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.TOGGLE_LIKE}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ article_id: article.id, user_id: userId }),
            });
            const result = await response.json();
            if (result.code === 0) {
                EventBus.emit(Events.ARTICLE_LIKE_CHANGED, { articleId: article.id, liked: newLiked, likeCount: newCount } as LikeChangedPayload);
            } else {
                setter(prev => prev.map(it => it.id === article.id ? { ...it, liked: article.liked, likes: article.likes } : it));
            }
        } catch {
            setter(prev => prev.map(it => it.id === article.id ? { ...it, liked: article.liked, likes: article.likes } : it));
        }
    }, [userId]);

    useEffect(() => {
        const off = EventBus.on(Events.ARTICLE_LIKE_CHANGED, ({ articleId, liked, likeCount }: LikeChangedPayload) => {
            const update = (prev: any[]) => prev.map(item => item.id === articleId ? { ...item, likes: likeCount, liked } : item);
            setMyNotes(update);
            setMyFavorites(update);
            setMyLiked(update);
            setMyViewed(update);
        });
        return off;
    }, []);

    const handleAuthorPress = useCallback((authorId: number) => {
        navigateToUserProfile(router, authorId, userId ?? null);
    }, [router, userId]);

    if (!isLoggedIn) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.loginPrompt}>
                    <Ionicons name="person-circle-outline" size={72} color={Colors.borderDark} />
                    <Text style={styles.loginPromptTitle}>登录后查看个人主页</Text>
                    <Text style={styles.loginPromptSub}>管理你的笔记、收藏和互动</Text>
                    <TouchableOpacity style={styles.loginPromptBtn} onPress={() => router.push('/login')}>
                        <Text style={styles.loginPromptBtnText}>登录 / 注册</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    if (loading) {
        return (
            <SafeAreaView style={CommonStyles.safeArea}>
                <View style={CommonStyles.loadingContainer}>
                    <ActivityIndicator size="small" color="gray" />
                    <Text style={CommonStyles.loadingText}>数据加载中</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error || !userData) {
        return (
            <SafeAreaView style={CommonStyles.safeArea}>
                <View style={CommonStyles.errorContainer}>
                    <Ionicons name="alert-circle" size={50} color={Colors.error} />
                    <Text style={CommonStyles.errorText}>{error || '未找到用户数据'}</Text>
                </View>
            </SafeAreaView>
        );
    }

    const renderWaterfall = (data: any[], onLike: (item: any) => void, label: string) => {
        if (tabDataLoading) {
            return <View style={styles.tabLoadingWrap}><ActivityIndicator size="small" color={Colors.textTertiary} /></View>;
        }
        if (data.length === 0) return <EmptyTabContent label={label} />;
        return (
            <WaterfallTwoColumnGrid
                items={data}
                keyExtractor={(item: any) => String(item.id)}
                renderItem={(item: any) => (
                    <WaterfallArticleCard
                        item={item}
                        onPress={(id) => router.push(`/article/${id}`)}
                        onLike={onLike}
                        onAuthorPress={handleAuthorPress}
                    />
                )}
            />
        );
    };

    const profileSection = (
        <LinearGradient
            colors={['#ededed', '#e8e8e8', '#f0f0f0']}
            style={styles.headerGradient}
            onLayout={(e) => setProfileH(e.nativeEvent.layout.height)}
        >
            <TouchableOpacity style={styles.profileHeader} activeOpacity={0.7}
                onPress={() => router.push('/profile-edit' as any)}>
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
                <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>

            <View style={styles.statsRow}>
                <StatItem count={userStats.following_count} label="关注"
                    onPress={() => router.push({ pathname: '/follow-list', params: { tab: 'following' } } as any)} />
                <StatItem count={userStats.followers_count} label="粉丝"
                    onPress={() => router.push({ pathname: '/follow-list', params: { tab: 'followers' } } as any)} />
                <StatItem count={userStats.likes_received} label="获赞" />
                <StatItem count={userStats.favorites_received} label="收藏" />
            </View>
        </LinearGradient>
    );

    const tabScrollProps = {
        style: styles.tabPage,
        contentContainerStyle: { paddingTop: totalHeaderH, minHeight: totalHeaderH + SCREEN_HEIGHT },
        showsVerticalScrollIndicator: false,
        onScroll: scrollHandler,
        scrollEventThrottle: 16,
    };

    return (
        <View style={styles.safeArea}>
            <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
                <TouchableOpacity style={styles.topBarBtn} onPress={() => {
                    if (!isLoggedIn) { router.push('/login'); return; }
                    setDrawerVisible(true);
                }}>
                    <Feather name="menu" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.topBarBtn} onPress={() => router.push('/scanner')}>
                    <MaterialCommunityIcons name="line-scan" size={22} color={Colors.textPrimary} />
                </TouchableOpacity>
            </View>
            <SettingsDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />

            <SwipeTabView
                tabs={TABS}
                onTabChange={handleMyTabChange}
                renderLayout={(tabBar, pager) => (
                    <View style={styles.pagerContainer}>
                        <Animated.View style={[styles.collapsibleHeader, {
                            transform: [{ translateY: headerTranslateY }],
                        }]}>
                            {profileSection}
                            <View style={styles.tabBarMask}
                                onLayout={(e) => setTabBarH(e.nativeEvent.layout.height)}>
                                <View style={styles.tabBarWrapper}>
                                    {tabBar}
                                </View>
                            </View>
                        </Animated.View>
                        {pager}
                    </View>
                )}
            >
                <ScrollView ref={(r) => { tabScrollRefs.current['notes'] = r; }} {...tabScrollProps}>
                    {renderWaterfall(myNotes, handleNoteLike, '笔记')}
                </ScrollView>

                <ScrollView ref={(r) => { tabScrollRefs.current['comments'] = r; }} {...tabScrollProps}>
                    {tabDataLoading ? (
                        <View style={styles.tabLoadingWrap}><ActivityIndicator size="small" color={Colors.textTertiary} /></View>
                    ) : myCommentsList.length === 0 ? (
                        <EmptyTabContent label="评论" />
                    ) : (
                        <View style={styles.commentsList}>
                            {myCommentsList.map((item: any) => (
                                <CommentListItem key={item.id} item={item}
                                    onPress={(id) => router.push(`/article/${id}`)} />
                            ))}
                        </View>
                    )}
                </ScrollView>

                <ScrollView ref={(r) => { tabScrollRefs.current['favorites'] = r; }} {...tabScrollProps}>
                    {renderWaterfall(myFavorites, (item) => handleListLike(item, setMyFavorites), '收藏')}
                </ScrollView>

                <ScrollView ref={(r) => { tabScrollRefs.current['liked'] = r; }} {...tabScrollProps}>
                    {renderWaterfall(myLiked, (item) => handleListLike(item, setMyLiked), '赞过')}
                </ScrollView>

                <ScrollView ref={(r) => { tabScrollRefs.current['viewed'] = r; }} {...tabScrollProps}>
                    {renderWaterfall(myViewed, (item) => handleListLike(item, setMyViewed), '看过')}
                </ScrollView>
            </SwipeTabView>
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#ededed' },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        backgroundColor: '#ededed',
        zIndex: 20,
    },
    topBarBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pagerContainer: { flex: 1 },
    collapsibleHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
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
    tabBarMask: {
        backgroundColor: '#ededed',
    },
    tabBarWrapper: {
        backgroundColor: Colors.backgroundWhite,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.border,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.xs,
    },
    tabPage: { flex: 1, backgroundColor: Colors.backgroundWhite },
    tabLoadingWrap: { paddingVertical: 60, alignItems: 'center' },
    emptyTab: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
    emptyTabText: { marginTop: Spacing.md, fontSize: FontSize.sm, color: Colors.textTertiary },
    commentsList: { padding: Spacing.md },
    myCommentItem: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
    },
    myCommentLeft: { flex: 1, marginRight: Spacing.md },
    myCommentContent: { fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 22, marginBottom: Spacing.xs },
    myCommentMeta: { fontSize: FontSize.xs, color: Colors.textTertiary },
    myCommentImage: { width: 56, height: 56, borderRadius: 6, backgroundColor: Colors.backgroundGray },
    loginPrompt: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
    loginPromptTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.textPrimary, marginTop: Spacing.xl },
    loginPromptSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.sm },
    loginPromptBtn: {
        marginTop: Spacing.xxl, backgroundColor: Colors.primary, paddingHorizontal: 48,
        paddingVertical: Spacing.md, borderRadius: 24,
    },
    loginPromptBtnText: { color: Colors.white, fontSize: FontSize.lg, fontWeight: '600' },
});
