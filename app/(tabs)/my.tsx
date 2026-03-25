import { useState, useEffect, useCallback } from 'react';
import {
    Text,
    View,
    StyleSheet,
    Image,
    ScrollView,
    SafeAreaView,
    Platform,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { buildApiUrl, API_ENDPOINTS, API_BASE_URL } from '../../config/api';
import { CommonStyles, Colors, Spacing, FontSize, Shadows } from '../../config/styles';
import { EventBus, Events, LikeChangedPayload } from '../../config/events';
import { useAuth } from '../../config/auth';
import { formatCount } from '../../config/utils';

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

const StatItem = ({ count, label }: { count: number; label: string }) => (
    <TouchableOpacity style={styles.statItem}>
        <Text style={styles.statCount}>{formatCount(count)}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
);

const TAB_KEYS = ['notes', 'comments', 'favorites', 'liked'] as const;
const TAB_LABELS = { notes: '笔记', comments: '评论', favorites: '收藏', liked: '赞过' };

type TabKey = typeof TAB_KEYS[number];

const EmptyTabContent = ({ label }: { label: string }) => (
    <View style={styles.emptyTab}>
        <Ionicons name="document-text-outline" size={48} color={Colors.borderDark} />
        <Text style={styles.emptyTabText}>暂无{label}内容</Text>
    </View>
);

const NoteItem = ({ item, onPress, onLike }: { item: any; onPress: (id: number) => void; onLike: (item: any) => void }) => (
    <TouchableOpacity style={styles.noteItem} activeOpacity={0.8} onPress={() => onPress(item.id)}>
        {item.image ? (
            <Image source={{ uri: item.image }} style={styles.noteImage} />
        ) : (
            <View style={[styles.noteImage, styles.noteImagePlaceholder]}>
                <Ionicons name="image-outline" size={24} color={Colors.borderDark} />
            </View>
        )}
        <View style={styles.noteContent}>
            <Text style={styles.noteTitle} numberOfLines={2}>{item.title}</Text>
            <View style={styles.noteFooter}>
                <Text style={styles.noteAuthor} numberOfLines={1}>{item.author}</Text>
                <TouchableOpacity
                    style={styles.noteLikeBtn}
                    onPress={(e) => { e.stopPropagation(); onLike(item); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name={item.liked ? 'heart' : 'heart-outline'} size={14} color={item.liked ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.noteLikeText, item.liked && { color: Colors.primary }]}>
                        {item.likes > 0 ? ` ${formatCount(item.likes)}` : ''}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    </TouchableOpacity>
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
            <Image source={{ uri: item.article_image }} style={styles.myCommentImage} />
        ) : null}
    </TouchableOpacity>
);

const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    try {
        const date = new Date(timeStr);
        return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
    } catch { return timeStr; }
};

export default function MyScreen() {
    const router = useRouter();
    const { userId, isLoggedIn } = useAuth();
    const [userData, setUserData] = useState<any>(null);
    const [userStats, setUserStats] = useState({ following_count: 0, followers_count: 0, likes_received: 0, favorites_received: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabKey>('notes');

    const [myNotes, setMyNotes] = useState<any[]>([]);
    const [myFavorites, setMyFavorites] = useState<any[]>([]);
    const [myLiked, setMyLiked] = useState<any[]>([]);
    const [myCommentsList, setMyCommentsList] = useState<any[]>([]);
    const [tabLoading, setTabLoading] = useState(false);

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

    useEffect(() => {
        if (!userId) return;
        setLoading(true);
        fetchUserData();
    }, [fetchUserData, userId]);

    const fetchStats = useCallback(async () => {
        if (!userId) return;
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.USER_STATS, { user_id: userId }));
            const result = await response.json();
            if (result.code === 0) setUserStats(result.data);
        } catch {}
    }, [userId]);

    const fetchMyNotes = useCallback(async () => {
        if (!userId) return;
        setTabLoading(true);
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.RECOMMENDATIONS, {
                page: 1, author_id: userId, user_id: userId,
            }));
            if (response.ok) {
                const data = await response.json();
                setMyNotes(Array.isArray(data) ? data : []);
            }
        } catch {} finally { setTabLoading(false); }
    }, [userId]);

    const fetchMyFavorites = useCallback(async () => {
        if (!userId) return;
        setTabLoading(true);
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.MY_FAVORITES, { user_id: userId, page: 1 }));
            const result = await response.json();
            if (result.code === 0) setMyFavorites(result.data || []);
        } catch {} finally { setTabLoading(false); }
    }, [userId]);

    const fetchMyLiked = useCallback(async () => {
        if (!userId) return;
        setTabLoading(true);
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.MY_LIKED, { user_id: userId, page: 1 }));
            const result = await response.json();
            if (result.code === 0) setMyLiked(result.data || []);
        } catch {} finally { setTabLoading(false); }
    }, [userId]);

    const fetchMyComments = useCallback(async () => {
        if (!userId) return;
        setTabLoading(true);
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.MY_COMMENTS, { user_id: userId, page: 1 }));
            const result = await response.json();
            if (result.code === 0) setMyCommentsList(result.data || []);
        } catch {} finally { setTabLoading(false); }
    }, [userId]);

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
        });
        return off;
    }, []);

    useFocusEffect(useCallback(() => {
        if (!userId) return;
        fetchUserData();
        fetchStats();
        switch (activeTab) {
            case 'notes': fetchMyNotes(); break;
            case 'favorites': fetchMyFavorites(); break;
            case 'liked': fetchMyLiked(); break;
            case 'comments': fetchMyComments(); break;
        }
    }, [userId, activeTab, fetchUserData, fetchStats, fetchMyNotes, fetchMyFavorites, fetchMyLiked, fetchMyComments]));

    useEffect(() => {
        switch (activeTab) {
            case 'notes': fetchMyNotes(); break;
            case 'favorites': fetchMyFavorites(); break;
            case 'liked': fetchMyLiked(); break;
            case 'comments': fetchMyComments(); break;
        }
    }, [activeTab]);

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

    const renderWaterfall = (data: any[], onLike: (item: any) => void) => {
        if (data.length === 0) return <EmptyTabContent label={TAB_LABELS[activeTab]} />;
        const cols: any[][] = [[], []];
        data.forEach((item, i) => cols[i % 2].push(item));
        return (
            <View style={styles.notesColumns}>
                {cols.map((col, ci) => (
                    <View key={ci} style={styles.notesColumn}>
                        {col.map((item: any) => (
                            <NoteItem key={item.id} item={item}
                                onPress={(id) => router.push(`/article/${id}`)}
                                onLike={onLike} />
                        ))}
                    </View>
                ))}
            </View>
        );
    };

    const renderTabContent = () => {
        if (tabLoading) {
            return <View style={styles.tabLoadingWrap}><ActivityIndicator size="small" color={Colors.textTertiary} /></View>;
        }
        switch (activeTab) {
            case 'notes':
                return renderWaterfall(myNotes, handleNoteLike);
            case 'favorites':
                return renderWaterfall(myFavorites, (item) => handleListLike(item, setMyFavorites));
            case 'liked':
                return renderWaterfall(myLiked, (item) => handleListLike(item, setMyLiked));
            case 'comments':
                if (myCommentsList.length === 0) return <EmptyTabContent label="评论" />;
                return (
                    <View style={styles.commentsList}>
                        {myCommentsList.map((item: any) => (
                            <CommentListItem key={item.id} item={item}
                                onPress={(id) => router.push(`/article/${id}`)} />
                        ))}
                    </View>
                );
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.scrollView} stickyHeaderIndices={[1]}>
                <LinearGradient colors={['#ededed', '#e8e8e8', '#f0f0f0']} style={styles.headerGradient}>
                    <TouchableOpacity style={styles.profileHeader} activeOpacity={0.7}
                        onPress={() => router.push('/profile-edit' as any)}>
                        <Image
                            source={{ uri: userData.avatar || 'https://picsum.photos/200/200?random=1' }}
                            style={styles.avatar}
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
                        <StatItem count={userStats.following_count} label="关注" />
                        <StatItem count={userStats.followers_count} label="粉丝" />
                        <StatItem count={userStats.likes_received} label="获赞" />
                        <StatItem count={userStats.favorites_received} label="收藏" />
                    </View>
                </LinearGradient>

                <View style={styles.tabBarWrapper}>
                    <View style={styles.tabBar}>
                        {TAB_KEYS.map((key) => (
                            <TouchableOpacity key={key} style={styles.tabItem} onPress={() => setActiveTab(key)}>
                                <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>
                                    {TAB_LABELS[key]}
                                </Text>
                                {activeTab === key && <View style={styles.tabIndicator} />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.tabContent}>
                    {renderTabContent()}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f0f0f0', paddingTop: Platform.OS === 'android' ? 25 : 0 },
    scrollView: { flex: 1 },
    headerGradient: { paddingTop: Platform.OS === 'ios' ? Spacing.md : Spacing.lg, paddingBottom: Spacing.lg },
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
    tabBarWrapper: { backgroundColor: Colors.backgroundWhite },
    tabBar: { flexDirection: 'row', backgroundColor: Colors.backgroundWhite, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
    tabItem: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, position: 'relative' },
    tabText: { fontSize: FontSize.md, color: Colors.textSecondary },
    tabTextActive: { color: Colors.textPrimary, fontWeight: '600' },
    tabIndicator: { position: 'absolute', bottom: 0, width: 24, height: 2.5, borderRadius: 2, backgroundColor: Colors.primary },
    tabContent: { backgroundColor: Colors.backgroundWhite, minHeight: 400 },
    tabLoadingWrap: { paddingVertical: 60, alignItems: 'center' },
    emptyTab: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
    emptyTabText: { marginTop: Spacing.md, fontSize: FontSize.sm, color: Colors.textTertiary },
    notesColumns: { flexDirection: 'row', paddingHorizontal: Spacing.xs, paddingTop: 5 },
    notesColumn: { flex: 1, marginHorizontal: 3 },
    noteItem: { backgroundColor: Colors.backgroundWhite, borderRadius: Spacing.sm - 2, marginBottom: Spacing.sm, ...Shadows.medium, overflow: 'hidden' },
    noteImage: { width: '100%', aspectRatio: 3 / 4, backgroundColor: Colors.backgroundGray },
    noteImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
    noteContent: { padding: Spacing.sm },
    noteTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, lineHeight: 18, marginBottom: Spacing.sm - 2 },
    noteFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    noteAuthor: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1 },
    noteLikeBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: Spacing.sm, paddingHorizontal: Spacing.sm - 2, paddingVertical: 2 },
    noteLikeText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '300' },
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
