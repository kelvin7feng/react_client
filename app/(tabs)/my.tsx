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
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { buildApiUrl, API_ENDPOINTS, API_BASE_URL } from '../../config/api';
import { CommonStyles, Colors, Spacing, FontSize, Shadows } from '../../config/styles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

const NoteItem = ({ item }: { item: any }) => {
    const imageUri = item.image && item.image.startsWith('/')
        ? `${API_BASE_URL}${item.image}`
        : item.image;

    return (
        <View style={styles.noteItem}>
            {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.noteImage} />
            ) : (
                <View style={[styles.noteImage, styles.noteImagePlaceholder]}>
                    <Ionicons name="image-outline" size={24} color={Colors.borderDark} />
                </View>
            )}
            <Text style={styles.noteTitle} numberOfLines={2}>{item.title}</Text>
            <View style={styles.noteFooter}>
                <Ionicons name="heart-outline" size={12} color={Colors.textTertiary} />
                <Text style={styles.noteFooterText}>{item.likes || 0}</Text>
            </View>
        </View>
    );
};

export default function MyScreen() {
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
            const response = await fetch(buildApiUrl(API_ENDPOINTS.RECOMMENDATIONS, { page: 1, author_id: 1000000 }));
            if (response.ok) {
                const data = await response.json();
                setMyNotes(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            // 静默处理
        } finally {
            setNotesLoading(false);
        }
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
                return (
                    <View style={styles.notesGrid}>
                        {myNotes.map((item: any) => (
                            <NoteItem key={item.id} item={item} />
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

const NOTE_GAP = 6;
const NOTE_WIDTH = (SCREEN_WIDTH - Spacing.sm * 2 - NOTE_GAP) / 2;

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
    notesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: Spacing.sm,
        gap: NOTE_GAP,
    },
    noteItem: {
        width: NOTE_WIDTH,
        backgroundColor: Colors.backgroundWhite,
        borderRadius: Spacing.sm,
        overflow: 'hidden',
        ...Shadows.small,
        marginBottom: 2,
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
    noteTitle: {
        fontSize: FontSize.sm,
        fontWeight: '500',
        color: Colors.textPrimary,
        paddingHorizontal: Spacing.sm,
        paddingTop: Spacing.sm,
        lineHeight: 18,
    },
    noteFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.sm,
    },
    noteFooterText: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginLeft: 3,
    },
});
