import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Text,
    View,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    Platform,
    TouchableOpacity,
    Dimensions,
    Animated,
    LayoutAnimation,
    UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useMyHome } from '@/features/bff/hooks';
import { toggleArticleLike } from '@/features/community/api';
import { queryKeys } from '@/shared/query/keys';
import { CommonStyles, Colors, Spacing, FontSize, Shadows } from '../../config/styles';
import { EventBus, Events, LikeChangedPayload, FavoriteChangedPayload } from '../../config/events';
import { useAuth } from '../../config/auth';
import { formatCount, navigateToUserProfile, navigateToArticle } from '../../config/utils';
import { RemoteImage } from '../../components/RemoteImage';
import { WaterfallArticleCard, WaterfallTwoColumnGrid } from '../../components/WaterfallArticleCard';
import { SwipeTabView } from '../../components/SwipeTabView';
import { SettingsDrawer } from '../../components/SettingsDrawer';
import { BouncingDotsIndicator } from '@/components/BouncingDotsIndicator';
import { LoadingStateView } from '@/components/LoadingStateView';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHIMMER_W = SCREEN_WIDTH * 2;

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

const StatItem = ({ count, label, onPress, light }: { count: number; label: string; onPress?: () => void; light?: boolean }) => (
    <TouchableOpacity style={styles.statItem} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
        <Text style={[styles.statCount, light && styles.statCountOnBg]}>{formatCount(count)}</Text>
        <Text style={[styles.statLabel, light && styles.statLabelOnBg]}>{label}</Text>
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

const SKEL_BONE = '#e8e8e8';

const MyScreenSkeleton = ({ topInset }: { topInset: number }) => {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.timing(anim, {
                toValue: 1,
                duration: 2500,
                useNativeDriver: true,
            }),
        );
        animation.start();
        return () => animation.stop();
    }, []);

    const translateX = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [-SHIMMER_W, SCREEN_WIDTH],
    });

    const shimmerOverlay = (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
            <LinearGradient
                colors={[SKEL_BONE, '#f5f5f5', SKEL_BONE]}
                locations={[0.08, 0.18, 0.33]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{ flex: 1, width: SHIMMER_W }}
            />
        </Animated.View>
    );

    const bone = (w: number | string, h: number, r = 6, extra?: object) => (
        <View style={[{ width: w, height: h, backgroundColor: SKEL_BONE, borderRadius: r, overflow: 'hidden' }, extra]}>
            {shimmerOverlay}
        </View>
    );

    const cardSkeleton = (titleW = '85%') => (
        <View style={skelStyles.card}>
            <View style={[skelStyles.cardImage, { overflow: 'hidden' }]}>
                {shimmerOverlay}
            </View>
            <View style={skelStyles.cardBody}>
                {bone(titleW, 12, 4)}
                <View style={skelStyles.cardFooter}>
                    {bone(50, 10, 4)}
                    {bone(30, 10, 4)}
                </View>
            </View>
        </View>
    );

    return (
        <View style={skelStyles.root}>
            {/* topBar: paddingTop + 36px btn + paddingBottom */}
            <View style={[skelStyles.topBar, { paddingTop: topInset + Spacing.sm }]}>
                {bone(36, 36, 18)}
                {bone(36, 36, 18)}
            </View>
            {/* profileSectionWrap: profileHeader + statsRow + paddingBottom */}
            <View style={skelStyles.profileWrap}>
                <View style={skelStyles.profileHeader}>
                    {bone(70, 70, 35)}
                    <View style={skelStyles.profileText}>
                        {bone(110, 18, 9, { marginBottom: Spacing.sm })}
                        {bone(160, 13)}
                    </View>
                </View>
                <View style={skelStyles.statsRow}>
                    {[0, 1, 2, 3].map(i => (
                        <View key={i} style={skelStyles.statItem}>
                            {bone(30, 16, 4, { marginBottom: 2 })}
                            {bone(22, 11, 4)}
                        </View>
                    ))}
                </View>
            </View>
            {/* tabBar + cards 白色圆角区域 */}
            <View style={skelStyles.tabBarMask}>
                <View style={skelStyles.contentArea}>
                    <View style={skelStyles.tabBarPlaceholder}>
                        {bone('75%', 20, 10)}
                    </View>
                    <View style={skelStyles.grid}>
                        <View style={skelStyles.gridCol}>
                            {cardSkeleton('70%')}
                            {cardSkeleton('55%')}
                        </View>
                        <View style={skelStyles.gridCol}>
                            {cardSkeleton('60%')}
                            {cardSkeleton('80%')}
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
};

const skelStyles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#ededed' },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md + 2,
    },
    profileWrap: {
        paddingBottom: Spacing.lg,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.xl,
    },
    profileText: { flex: 1, marginLeft: Spacing.lg },
    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.sm,
        gap: Spacing.xxl,
    },
    statItem: { alignItems: 'center' },
    tabBarMask: {
        flex: 1,
        backgroundColor: '#ededed',
    },
    contentArea: {
        flex: 1,
        backgroundColor: Colors.backgroundWhite,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    tabBarPlaceholder: {
        alignItems: 'center',
        paddingTop: Spacing.md + 2,
        paddingBottom: Spacing.md,
    },
    grid: {
        flex: 1,
        flexDirection: 'row',
        paddingHorizontal: Spacing.xs,
        marginTop: 5,
    },
    gridCol: {
        flex: 1,
        marginHorizontal: 3,
    },
    card: {
        backgroundColor: Colors.backgroundWhite,
        borderRadius: Spacing.sm - 2,
        marginBottom: Spacing.sm,
        overflow: 'hidden',
        ...Shadows.medium,
    },
    cardImage: {
        width: '100%',
        aspectRatio: 3 / 4,
        backgroundColor: SKEL_BONE,
    },
    cardBody: {
        padding: Spacing.sm,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: Spacing.sm - 2,
    },
});

export default function MyScreen() {
    const router = useRouter();
    const { userId, isLoggedIn } = useAuth();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();

    const { data, isLoading, error: queryError } = useMyHome(userId);

    const userData = data?.user ?? null;
    const userStats = data?.stats ?? { following_count: 0, followers_count: 0, likes_received: 0, favorites_received: 0 };

    const [myNotes, setMyNotes] = useState<any[]>([]);
    const [myFavorites, setMyFavorites] = useState<any[]>([]);
    const [myLiked, setMyLiked] = useState<any[]>([]);
    const [myViewed, setMyViewed] = useState<any[]>([]);
    const [myCommentsList, setMyCommentsList] = useState<any[]>([]);

    useEffect(() => {
        if (!data) return;
        setMyNotes(data.notes || []);
        setMyCommentsList(data.comments || []);
        setMyFavorites(data.favorites || []);
        setMyLiked(data.liked || []);
        setMyViewed(data.viewed || []);
    }, [data]);

    const [topBarH, setTopBarH] = useState(0);
    const [tabBarH, setTabBarH] = useState(0);
    const [profileH, setProfileH] = useState(0);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const scrollY = useRef(new Animated.Value(0)).current;
    const currentOffsetRef = useRef(0);
    const tabScrollRefs = useRef<Record<string, ScrollView | null>>({});
    const activeTabKeyRef = useRef(TABS[0].key);
    const syncTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const skeletonFade = useRef(new Animated.Value(1)).current;
    const [skeletonDismissed, setSkeletonDismissed] = useState(false);

    const safeProfileH = Math.max(profileH, 1);
    const totalHeaderH = topBarH + profileH + tabBarH;
    const headerMeasured = topBarH > 0 && profileH > 0 && tabBarH > 0;
    const showContent = !isLoading && !!userData;
    const contentReady = showContent && headerMeasured;

    useEffect(() => {
        if (data?.user?.bg_image) ExpoImage.prefetch(data.user.bg_image);
    }, [data?.user?.bg_image]);

    const headerTranslateY = scrollY.interpolate({
        inputRange: [0, safeProfileH],
        outputRange: [0, -safeProfileH],
        extrapolate: 'clamp',
    });

    const navAvatarOpacity = scrollY.interpolate({
        inputRange: [safeProfileH * 0.5, safeProfileH * 0.85],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    const profileContentOpacity = scrollY.interpolate({
        inputRange: [0, safeProfileH * 0.6],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });

    const scrollHandlersRef = useRef<Record<string, (e: any) => void>>({});
    const getScrollHandler = (tabKey: string) => {
        if (!scrollHandlersRef.current[tabKey]) {
            scrollHandlersRef.current[tabKey] = (e: any) => {
                const y = e.nativeEvent.contentOffset.y;
                if (tabKey === activeTabKeyRef.current) {
                    scrollY.setValue(y);
                    currentOffsetRef.current = y;
                }
            };
        }
        return scrollHandlersRef.current[tabKey];
    };

    const handleMyTabChange = useCallback((key: string) => {
        syncTimersRef.current.forEach(clearTimeout);
        syncTimersRef.current = [];

        activeTabKeyRef.current = key;

        if (profileH <= 0) return;

        const targetY = Math.min(Math.max(currentOffsetRef.current, 0), profileH);
        if (targetY <= 0) return;

        const doSync = () => {
            tabScrollRefs.current[key]?.scrollTo({ y: targetY, animated: false });
        };

        doSync();
        syncTimersRef.current.push(
            setTimeout(doSync, 100),
            setTimeout(doSync, 450),
        );
    }, [profileH]);

    useEffect(() => {
        if (!isLoggedIn) {
            router.replace('/login');
        }
    }, [isLoggedIn, router]);

    const handleNoteLike = useCallback(async (article: any) => {
        const newLiked = !article.liked;
        const newCount = newLiked ? article.likes + 1 : Math.max(article.likes - 1, 0);
        setMyNotes(prev => prev.map(it => it.id === article.id ? { ...it, liked: newLiked, likes: newCount } : it));
        try {
            await toggleArticleLike(article.id);
            EventBus.emit(Events.ARTICLE_LIKE_CHANGED, { articleId: article.id, liked: newLiked, likeCount: newCount } as LikeChangedPayload);
        } catch {
            setMyNotes(prev => prev.map(it => it.id === article.id ? { ...it, liked: article.liked, likes: article.likes } : it));
        }
    }, [userId]);

    const handleListLike = useCallback(async (article: any, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
        const newLiked = !article.liked;
        const newCount = newLiked ? article.likes + 1 : Math.max(article.likes - 1, 0);
        setter(prev => prev.map(it => it.id === article.id ? { ...it, liked: newLiked, likes: newCount } : it));
        try {
            await toggleArticleLike(article.id);
            EventBus.emit(Events.ARTICLE_LIKE_CHANGED, { articleId: article.id, liked: newLiked, likeCount: newCount } as LikeChangedPayload);
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

    useEffect(() => {
        const off = EventBus.on(Events.ARTICLE_FAVORITE_CHANGED, ({ articleId, favorited }: FavoriteChangedPayload) => {
            if (!favorited) {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setMyFavorites(prev => prev.filter(item => item.id !== articleId));
            }
            queryClient.invalidateQueries({ queryKey: ['myHome'] });
        });
        return off;
    }, [queryClient]);

    useEffect(() => {
        const off = EventBus.on(Events.ARTICLE_DELETED, ({ articleId }: { articleId: number }) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            const remove = (prev: any[]) => prev.filter(item => item.id !== articleId);
            setMyNotes(remove);
            setMyFavorites(remove);
            setMyLiked(remove);
            setMyViewed(remove);
            queryClient.invalidateQueries({ queryKey: ['myHome'] });
            queryClient.removeQueries({ queryKey: queryKeys.articlePage(articleId, userId) });
        });
        return off;
    }, [queryClient, userId]);

    useEffect(() => {
        if (contentReady && !skeletonDismissed) {
            Animated.timing(skeletonFade, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start(() => setSkeletonDismissed(true));
        }
    }, [contentReady, skeletonDismissed]);

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

    if (!isLoading && (queryError || !userData)) {
        return (
            <SafeAreaView style={CommonStyles.safeArea}>
                <View style={CommonStyles.errorContainer}>
                    <Ionicons name="alert-circle" size={50} color={Colors.error} />
                    <Text style={CommonStyles.errorText}>{queryError?.message || '未找到用户数据'}</Text>
                </View>
            </SafeAreaView>
        );
    }

    const renderWaterfall = (data: any[], onLike: (item: any) => void, label: string) => {
        if (data.length === 0) return <EmptyTabContent label={label} />;
        return (
            <WaterfallTwoColumnGrid
                items={data}
                keyExtractor={(item: any) => String(item.id)}
                renderItem={(item: any) => (
                    <WaterfallArticleCard
                        item={item}
                        onPress={() => navigateToArticle(router, queryClient, item, userId)}
                        onLike={onLike}
                        onAuthorPress={handleAuthorPress}
                    />
                )}
            />
        );
    };

    const hasBgImage = !!userData?.bg_image;

    const profileSection = userData ? (
        <View
            style={styles.profileSectionWrap}
            onLayout={(e) => setProfileH(e.nativeEvent.layout.height)}
        >
            {!hasBgImage && (
                <LinearGradient
                    colors={['#ededed', '#e8e8e8', '#f0f0f0']}
                    style={StyleSheet.absoluteFillObject}
                />
            )}

            <Animated.View style={{ opacity: profileContentOpacity }}>
                <TouchableOpacity style={styles.profileHeader} activeOpacity={0.7}
                    onPress={() => router.push('/profile-edit' as any)}>
                    <RemoteImage
                        uri={userData.avatar || 'https://picsum.photos/200/200?random=1'}
                        style={styles.avatar}
                        contentFit="cover"
                    />
                    <View style={styles.profileInfo}>
                        <View style={styles.nameRow}>
                            <GenderIcon gender={userData.gender ?? 0} />
                            <Text style={[styles.name, hasBgImage && styles.textOnBg]}>
                                {userData.username || '未知用户'}
                            </Text>
                        </View>
                        <Text style={[styles.signature, hasBgImage && styles.subTextOnBg]} numberOfLines={2}>
                            {userData.signature || '暂无个性签名'}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18}
                        color={hasBgImage ? 'rgba(255,255,255,0.7)' : Colors.textTertiary} />
                </TouchableOpacity>

                <View style={styles.statsRow}>
                    <StatItem count={userStats.following_count} label="关注" light={hasBgImage}
                        onPress={() => router.push({ pathname: '/follow-list', params: { tab: 'following' } } as any)} />
                    <StatItem count={userStats.followers_count} label="粉丝" light={hasBgImage}
                        onPress={() => router.push({ pathname: '/follow-list', params: { tab: 'followers' } } as any)} />
                    <StatItem count={userStats.likes_received} label="获赞" light={hasBgImage} />
                    <StatItem count={userStats.favorites_received} label="收藏" light={hasBgImage} />
                </View>
            </Animated.View>
        </View>
    ) : null;

    const baseTabScrollStyle = {
        style: styles.tabPage,
        contentContainerStyle: { paddingTop: totalHeaderH, minHeight: totalHeaderH + SCREEN_HEIGHT },
        showsVerticalScrollIndicator: false,
        scrollEventThrottle: 16,
    };

    return (
        <View style={[styles.safeArea, hasBgImage && contentReady && styles.safeAreaWithBg]}>
            {showContent && (
                <>
                    <SettingsDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />

                    <SwipeTabView
                        tabs={TABS}
                        onTabChange={handleMyTabChange}
                        pagerBackgroundColor={Colors.backgroundWhite}
                        renderLayout={(tabBar, pager) => (
                            <View style={styles.pagerContainer}>
                                <Animated.View style={[styles.collapsibleHeader, {
                                    transform: [{ translateY: headerTranslateY }],
                                }]}>
                                    {hasBgImage && (
                                        <>
                                            <RemoteImage
                                                uri={userData!.bg_image!}
                                                style={StyleSheet.absoluteFillObject}
                                                contentFit="cover"
                                                cachePolicy="memory-disk"
                                                transition={200}
                                            />
                                            <View style={styles.bgOverlay} />
                                            <LinearGradient
                                                colors={['transparent', 'rgba(0,0,0,0.8)']}
                                                style={styles.bgBottomFade}
                                            />
                                        </>
                                    )}
                                    <View style={{ height: topBarH }} />
                                    {profileSection}
                                    <View style={[styles.tabBarMask, hasBgImage && styles.tabBarMaskTransparent]}
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
                <ScrollView ref={(r) => { tabScrollRefs.current['notes'] = r; }} {...baseTabScrollStyle} onScroll={getScrollHandler('notes')}>
                    {renderWaterfall(myNotes, handleNoteLike, '笔记')}
                </ScrollView>

                <ScrollView ref={(r) => { tabScrollRefs.current['comments'] = r; }} {...baseTabScrollStyle} onScroll={getScrollHandler('comments')}>
                    {myCommentsList.length === 0 ? (
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

                <ScrollView ref={(r) => { tabScrollRefs.current['favorites'] = r; }} {...baseTabScrollStyle} onScroll={getScrollHandler('favorites')}>
                    {renderWaterfall(myFavorites, (item) => handleListLike(item, setMyFavorites), '收藏')}
                </ScrollView>

                <ScrollView ref={(r) => { tabScrollRefs.current['liked'] = r; }} {...baseTabScrollStyle} onScroll={getScrollHandler('liked')}>
                    {renderWaterfall(myLiked, (item) => handleListLike(item, setMyLiked), '赞过')}
                </ScrollView>

                <ScrollView ref={(r) => { tabScrollRefs.current['viewed'] = r; }} {...baseTabScrollStyle} onScroll={getScrollHandler('viewed')}>
                    {renderWaterfall(myViewed, (item) => handleListLike(item, setMyViewed), '看过')}
                </ScrollView>
                    </SwipeTabView>

                    <View
                        style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }, hasBgImage && styles.topBarWithBg]}
                        onLayout={(e) => setTopBarH(e.nativeEvent.layout.height)}
                    >
                        <TouchableOpacity style={styles.topBarBtn} onPress={() => {
                            if (!isLoggedIn) { router.push('/login'); return; }
                            setDrawerVisible(true);
                        }}>
                            <Feather name="menu" size={24} color={hasBgImage ? Colors.white : Colors.textPrimary} />
                        </TouchableOpacity>

                        <Animated.View style={[styles.navAvatarWrap, { opacity: navAvatarOpacity }]}>
                            <ExpoImage
                                source={{ uri: userData!.avatar || 'https://picsum.photos/200/200?random=1' }}
                                style={styles.navAvatar}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                            />
                            <Text style={[styles.navUsername, hasBgImage && { color: Colors.white }]} numberOfLines={1}>
                                {userData!.username || ''}
                            </Text>
                        </Animated.View>

                        <TouchableOpacity style={styles.topBarBtn} onPress={() => router.push('/scanner')}>
                            <MaterialCommunityIcons name="line-scan" size={22} color={hasBgImage ? Colors.white : Colors.textPrimary} />
                        </TouchableOpacity>
                    </View>
                </>
            )}

            {!skeletonDismissed && (
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: skeletonFade, zIndex: 30 }]}>
                    <MyScreenSkeleton topInset={insets.top} />
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#ededed' },
    safeAreaWithBg: { backgroundColor: '#2c2c2e' },
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        backgroundColor: '#ededed',
        zIndex: 20,
    },
    topBarWithBg: { backgroundColor: 'transparent' },
    topBarBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    navAvatarWrap: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    navAvatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1.5,
        borderColor: Colors.white,
    },
    navUsername: {
        marginLeft: Spacing.sm,
        fontSize: FontSize.sm,
        fontWeight: '600',
        color: Colors.textPrimary,
        maxWidth: 100,
    },
    pagerContainer: { flex: 1 },
    collapsibleHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    profileSectionWrap: { paddingBottom: Spacing.lg, overflow: 'hidden' },
    bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
    bgBottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '35%' },
    textOnBg: { color: Colors.white },
    subTextOnBg: { color: 'rgba(255,255,255,0.8)' },
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
    statCountOnBg: { color: Colors.white },
    statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
    statLabelOnBg: { color: 'rgba(255,255,255,0.8)' },
    tabBarMask: {
        backgroundColor: '#ededed',
    },
    tabBarMaskTransparent: { backgroundColor: 'transparent' },
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
