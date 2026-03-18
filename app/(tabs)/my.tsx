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

const CURRENT_USER_ID = 1000000;


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
        <Text style={styles.statCount}>{count >= 10000 ? `${(count / 10000).toFixed(1)}万` : count}</Text>
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
                        {item.likes > 0 ? ` ${item.likes}` : ''}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    </TouchableOpacity>
);

export default function MyScreen() {
    const router = useRouter();
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState<TabKey>('notes');
    const [myNotes, setMyNotes] = useState([]);
    const [notesLoading, setNotesLoading] = useState(false);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                setLoading(true);
                const response = await fetch(buildApiUrl(API_ENDPOINTS.GET_BASIC_INFO, { id: 1000000 }));
                if (!response.ok) throw new Error(`HTTP错误! 状态: ${response.status}`);
                const result = await response.json();
                if (result.code !== 0) throw new Error(result.msg || '获取用户信息失败');
                setUserData(result.data);
            } catch (err) {
                setError(err.message);
                Alert.alert('错误', '获取用户信息失败: ' + err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchUserData();
    }, []);

    const fetchMyNotes = useCallback(async () => {
        setNotesLoading(true);
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.RECOMMENDATIONS, {
                page: 1, author_id: CURRENT_USER_ID, user_id: CURRENT_USER_ID,
            }));
            if (response.ok) {
                const data = await response.json();
                setMyNotes(Array.isArray(data) ? data : []);
            }
        } catch {
            // 静默处理
        } finally {
            setNotesLoading(false);
        }
    }, []);

    const handleNoteLike = useCallback(async (article: any) => {
        const newLiked = !article.liked;
        const newCount = newLiked ? article.likes + 1 : Math.max(article.likes - 1, 0);

        setMyNotes(prev => prev.map(it =>
            it.id === article.id ? { ...it, liked: newLiked, likes: newCount } : it
        ));

        try {
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.TOGGLE_LIKE}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ article_id: article.id, user_id: CURRENT_USER_ID }),
            });
            const result = await response.json();
            if (result.code === 0) {
                EventBus.emit(Events.ARTICLE_LIKE_CHANGED, {
                    articleId: article.id, liked: newLiked, likeCount: newCount,
                } as LikeChangedPayload);
            } else {
                setMyNotes(prev => prev.map(it =>
                    it.id === article.id ? { ...it, liked: article.liked, likes: article.likes } : it
                ));
            }
        } catch {
            setMyNotes(prev => prev.map(it =>
                it.id === article.id ? { ...it, liked: article.liked, likes: article.likes } : it
            ));
        }
    }, []);

    useEffect(() => {
        const off = EventBus.on(Events.ARTICLE_LIKE_CHANGED, ({ articleId, liked, likeCount }: LikeChangedPayload) => {
            setMyNotes(prev => prev.map(item =>
                item.id === articleId ? { ...item, likes: likeCount, liked } : item
            ));
        });
        return off;
    }, []);

    useFocusEffect(
        useCallback(() => {
            if (activeTab === 'notes') {
                fetchMyNotes();
            }
        }, [activeTab, fetchMyNotes])
    );

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

    if (error) {
        return (
            <SafeAreaView style={CommonStyles.safeArea}>
                <View style={CommonStyles.errorContainer}>
                    <Ionicons name="alert-circle" size={50} color={Colors.error} />
                    <Text style={CommonStyles.errorText}>加载失败</Text>
                    <Text style={CommonStyles.errorSubText}>{error}</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!userData) {
        return (
            <SafeAreaView style={CommonStyles.safeArea}>
                <View style={CommonStyles.errorContainer}>
                    <Ionicons name="person" size={50} color={Colors.textDisabled} />
                    <Text style={CommonStyles.errorText}>未找到用户数据</Text>
                </View>
            </SafeAreaView>
        );
    }

    const renderTabContent = () => {
        switch (activeTab) {
            case 'notes':
                if (notesLoading) {
                    return (
                        <View style={styles.tabLoading}>
                            <ActivityIndicator size="small" color={Colors.textTertiary} />
                        </View>
                    );
                }
                if (myNotes.length === 0) {
                    return <EmptyTabContent label="笔记" />;
                }
                const cols: any[][] = [[], []];
                myNotes.forEach((item: any, i: number) => cols[i % 2].push(item));
                return (
                    <View style={styles.notesColumns}>
                        {cols.map((col, ci) => (
                            <View key={ci} style={styles.notesColumn}>
                                {col.map((item: any) => (
                                    <NoteItem
                                        key={item.id}
                                        item={item}
                                        onPress={(id) => router.push(`/article/${id}`)}
                                        onLike={handleNoteLike}
                                    />
                                ))}
                            </View>
                        ))}
                    </View>
                );
            case 'comments':
                return <EmptyTabContent label="评论" />;
            case 'favorites':
                return <EmptyTabContent label="收藏" />;
            case 'liked':
                return <EmptyTabContent label="赞过" />;
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.scrollView} stickyHeaderIndices={[1]}>
                {/* 顶部渐变区域：头像 + 信息 + 统计 */}
                <LinearGradient
                    colors={['#ededed', '#e8e8e8', '#f0f0f0']}
                    style={styles.headerGradient}
                >
                    <View style={styles.profileHeader}>
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
                    </View>

                    {/* 统计数据 */}
                    <View style={styles.statsRow}>
                        <StatItem count={0} label="关注" />
                        <StatItem count={0} label="粉丝" />
                        <StatItem count={0} label="获赞" />
                        <StatItem count={0} label="收藏" />
                    </View>
                </LinearGradient>

                {/* Tab 栏 */}
                <View style={styles.tabBarWrapper}>
                    <View style={styles.tabBar}>
                        {TAB_KEYS.map((key) => (
                            <TouchableOpacity
                                key={key}
                                style={styles.tabItem}
                                onPress={() => setActiveTab(key)}
                            >
                                <Text style={[
                                    styles.tabText,
                                    activeTab === key && styles.tabTextActive,
                                ]}>
                                    {TAB_LABELS[key]}
                                </Text>
                                {activeTab === key && <View style={styles.tabIndicator} />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Tab 内容 */}
                <View style={styles.tabContent}>
                    {renderTabContent()}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        paddingTop: Platform.OS === 'android' ? 25 : 0,
    },
    scrollView: {
        flex: 1,
    },
    headerGradient: {
        paddingTop: Platform.OS === 'ios' ? Spacing.md : Spacing.lg,
        paddingBottom: Spacing.lg,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.xl,
    },
    avatar: {
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 2,
        borderColor: Colors.white,
        ...Shadows.large,
    },
    profileInfo: {
        flex: 1,
        marginLeft: Spacing.lg,
        justifyContent: 'center',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.xs + 2,
    },
    genderBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.sm,
    },
    name: {
        fontSize: FontSize.xl,
        fontWeight: 'bold',
        color: Colors.textPrimary,
    },
    signature: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
    },
    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.sm,
    },
    statItem: {
        marginRight: Spacing.xxl,
        alignItems: 'center',
    },
    statCount: {
        fontSize: FontSize.lg,
        fontWeight: 'bold',
        color: Colors.textPrimary,
    },
    statLabel: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    tabBarWrapper: {
        backgroundColor: Colors.backgroundWhite,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: Colors.backgroundWhite,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.border,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.md,
        position: 'relative',
    },
    tabText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
    },
    tabTextActive: {
        color: Colors.textPrimary,
        fontWeight: '600',
    },
    tabIndicator: {
        position: 'absolute',
        bottom: 0,
        width: 24,
        height: 2.5,
        borderRadius: 2,
        backgroundColor: Colors.primary,
    },
    tabContent: {
        backgroundColor: Colors.backgroundWhite,
        minHeight: 400,
    },
    tabLoading: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    emptyTab: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
    },
    emptyTabText: {
        marginTop: Spacing.md,
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
    },
    notesColumns: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.xs,
        paddingTop: 5,
    },
    notesColumn: {
        flex: 1,
        marginHorizontal: 3,
    },
    noteItem: {
        backgroundColor: Colors.backgroundWhite,
        borderRadius: Spacing.sm - 2,
        marginBottom: Spacing.sm,
        ...Shadows.medium,
        overflow: 'hidden',
    },
    noteImage: {
        width: '100%',
        aspectRatio: 3 / 4,
        backgroundColor: Colors.backgroundGray,
    },
    noteImagePlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    noteContent: {
        padding: Spacing.sm,
    },
    noteTitle: {
        fontSize: FontSize.sm,
        fontWeight: '600',
        color: Colors.textPrimary,
        lineHeight: 18,
        marginBottom: Spacing.sm - 2,
    },
    noteFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    noteAuthor: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        flex: 1,
    },
    noteLikeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: Spacing.sm,
        paddingHorizontal: Spacing.sm - 2,
        paddingVertical: 2,
    },
    noteLikeText: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        fontWeight: '300',
    },
});
