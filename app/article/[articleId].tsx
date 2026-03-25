import { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Dimensions,
    Alert,
    Modal,
    Animated,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL, API_ENDPOINTS, buildApiUrl } from '../../config/api';
import { Colors, Spacing, FontSize, Shadows } from '../../config/styles';
import { EventBus, Events, LikeChangedPayload } from '../../config/events';
import { useAuth } from '../../config/auth';
import { formatCount } from '../../config/utils';
import { RemoteImage } from '../../components/RemoteImage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 时间格式化
const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    try {
        const date = new Date(timeStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}小时前`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}天前`;
        return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
    } catch {
        return timeStr;
    }
};

export default function ArticleDetailScreen() {
    const { articleId } = useLocalSearchParams<{ articleId: string }>();
    const router = useRouter();
    const { userId, isLoggedIn } = useAuth();

    const [article, setArticle] = useState<any>(null);
    const [comments, setComments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [favorited, setFavorited] = useState(false);
    const [favoriteCount, setFavoriteCount] = useState(0);
    const [commentText, setCommentText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [followed, setFollowed] = useState(false);
    const [shareModalVisible, setShareModalVisible] = useState(false);
    const shareSlideAnim = useRef(new Animated.Value(0)).current;
    const inputRef = useRef<TextInput>(null);

    const isOwnArticle = article?.author_id === userId;

    const fetchArticle = useCallback(async () => {
        try {
            const response = await fetch(
                buildApiUrl(API_ENDPOINTS.GET_ARTICLE_DETAIL, {
                    article_id: articleId!,
                    user_id: userId || 0,
                })
            );
            const result = await response.json();
            if (result.code === 0) {
                setArticle(result.data);
                setLiked(result.data.liked);
                setLikeCount(result.data.like_count);
                setFavorited(result.data.favorited);
                setFavoriteCount(result.data.favorite_count || 0);
                setFollowed(result.data.followed);
            }
        } catch (err) {
            Alert.alert('加载失败', '无法获取文章详情');
        } finally {
            setLoading(false);
        }
    }, [articleId, userId]);

    const fetchComments = useCallback(async () => {
        try {
            const response = await fetch(
                buildApiUrl(API_ENDPOINTS.GET_COMMENTS, { article_id: articleId!, page: 1 })
            );
            const result = await response.json();
            if (result.code === 0) {
                setComments(result.data || []);
            }
        } catch { }
    }, [articleId]);

    useEffect(() => {
        fetchArticle();
        fetchComments();
    }, [fetchArticle, fetchComments]);

    const handleLike = async () => {
        if (!isLoggedIn) { router.push('/login'); return; }
        const prevLiked = liked;
        const prevCount = likeCount;
        const newLiked = !liked;
        const newCount = liked ? likeCount - 1 : likeCount + 1;
        setLiked(newLiked);
        setLikeCount(newCount);

        try {
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.TOGGLE_LIKE}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ article_id: Number(articleId), user_id: userId }),
            });
            const result = await response.json();
            if (result.code !== 0) {
                setLiked(prevLiked);
                setLikeCount(prevCount);
            } else {
                EventBus.emit(Events.ARTICLE_LIKE_CHANGED, {
                    articleId: Number(articleId),
                    liked: newLiked,
                    likeCount: newCount,
                } as LikeChangedPayload);
            }
        } catch {
            setLiked(prevLiked);
            setLikeCount(prevCount);
        }
    };

    const handleSubmitComment = async () => {
        if (!isLoggedIn) { router.push('/login'); return; }
        if (!commentText.trim()) return;
        setSubmitting(true);
        try {
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CREATE_COMMENT}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    article_id: Number(articleId),
                    author_id: userId,
                    content: commentText.trim(),
                }),
            });
            const result = await response.json();
            if (result.code === 0) {
                setCommentText('');
                inputRef.current?.blur();
                fetchComments();
            } else {
                Alert.alert('评论失败', result.msg);
            }
        } catch {
            Alert.alert('评论失败', '网络错误');
        } finally {
            setSubmitting(false);
        }
    };

    const openShareModal = () => {
        setShareModalVisible(true);
        Animated.spring(shareSlideAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
        }).start();
    };

    const closeShareModal = (cb?: () => void) => {
        Animated.timing(shareSlideAnim, {
            toValue: 0,
            duration: 120,
            useNativeDriver: true,
        }).start(() => {
            setShareModalVisible(false);
            cb?.();
        });
    };

    const handleShareAction = async (action: string) => {
        closeShareModal(async () => {
            if (action === '复制链接') {
                await Clipboard.setStringAsync(`${API_BASE_URL}/article/${articleId}`);
                Alert.alert('提示', '链接已复制到剪贴板');
            } else if (action === '保存图片') {
                if (article?.images?.length > 0) {
                    try {
                        const { status } = await MediaLibrary.requestPermissionsAsync();
                        if (status !== 'granted') {
                            Alert.alert('提示', '需要相册权限');
                            return;
                        }
                        const imageUrl = article.images[0].image_url;
                        const fileUri = FileSystem.cacheDirectory + 'share_image.jpg';
                        const { uri } = await FileSystem.downloadAsync(imageUrl, fileUri);
                        await MediaLibrary.saveToLibraryAsync(uri);
                        Alert.alert('成功', '图片已保存到相册');
                    } catch {
                        Alert.alert('失败', '保存图片失败');
                    }
                } else {
                    Alert.alert('提示', '该文章没有图片');
                }
            } else {
                Alert.alert('提示', `${action}功能开发中`);
            }
        });
    };

    const handleFollow = async () => {
        if (!isLoggedIn) { router.push('/login'); return; }
        const prev = followed;
        setFollowed(!prev);
        try {
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.TOGGLE_FOLLOW}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ follower_id: userId, following_id: article.author_id }),
            });
            const result = await response.json();
            if (result.code !== 0) {
                setFollowed(prev);
            } else {
                EventBus.emit(Events.FOLLOW_CHANGED, { userId: article.author_id, followed: !prev });
            }
        } catch {
            setFollowed(prev);
        }
    };

    const handleFavorite = async () => {
        if (!isLoggedIn) { router.push('/login'); return; }
        const prevFavorited = favorited;
        const prevCount = favoriteCount;
        const newFavorited = !favorited;
        const newCount = favorited ? favoriteCount - 1 : favoriteCount + 1;
        setFavorited(newFavorited);
        setFavoriteCount(newCount);
        try {
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.TOGGLE_FAVORITE}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ article_id: Number(articleId), user_id: userId }),
            });
            const result = await response.json();
            if (result.code !== 0) {
                setFavorited(prevFavorited);
                setFavoriteCount(prevCount);
            } else {
                EventBus.emit(Events.ARTICLE_FAVORITE_CHANGED, { articleId: Number(articleId), favorited: newFavorited });
            }
        } catch {
            setFavorited(prevFavorited);
            setFavoriteCount(prevCount);
        }
    };

    const handleCommentLike = async (commentId: number, currentlyLiked: boolean, currentCount: number) => {
        if (!isLoggedIn) { router.push('/login'); return; }
        const newLiked = !currentlyLiked;
        const newCount = currentlyLiked ? currentCount - 1 : currentCount + 1;
        setComments(prev => prev.map(c => {
            if (c.id === commentId) return { ...c, liked: newLiked, like_count: newCount };
            if (c.children) {
                return { ...c, children: c.children.map((ch: any) =>
                    ch.id === commentId ? { ...ch, liked: newLiked, like_count: newCount } : ch
                )};
            }
            return c;
        }));
        try {
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.TOGGLE_COMMENT_LIKE}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment_id: commentId, user_id: userId }),
            });
            const result = await response.json();
            if (result.code !== 0) {
                setComments(prev => prev.map(c => {
                    if (c.id === commentId) return { ...c, liked: currentlyLiked, like_count: currentCount };
                    if (c.children) {
                        return { ...c, children: c.children.map((ch: any) =>
                            ch.id === commentId ? { ...ch, liked: currentlyLiked, like_count: currentCount } : ch
                        )};
                    }
                    return c;
                }));
            }
        } catch {
            setComments(prev => prev.map(c => {
                if (c.id === commentId) return { ...c, liked: currentlyLiked, like_count: currentCount };
                if (c.children) {
                    return { ...c, children: c.children.map((ch: any) =>
                        ch.id === commentId ? { ...ch, liked: currentlyLiked, like_count: currentCount } : ch
                    )};
                }
                return c;
            }));
        }
    };

    const handleViewAllReplies = async (parentId: number) => {
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.GET_CHILD_COMMENTS, { parent_id: parentId, page: 1 }));
            const result = await response.json();
            if (result.code === 0) {
                setComments(prev => prev.map(c =>
                    c.id === parentId ? { ...c, children: result.data, _expanded: true } : c
                ));
            }
        } catch {}
    };

    const onImageScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        setCurrentImageIndex(index);
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </SafeAreaView>
        );
    }

    if (!article) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <Text style={{ color: Colors.textSecondary }}>文章不存在</Text>
            </SafeAreaView>
        );
    }

    const location = [article.location_city, article.location_district].filter(Boolean).join(' ');

    return (
        <SafeAreaView style={styles.container}>
            {/* 顶部固定栏 */}
            <View style={styles.topBar}>
                <View style={styles.topBarLeft}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <RemoteImage
                        uri={article.author_avatar || 'https://picsum.photos/100/100'}
                        style={styles.topBarAvatar}
                        contentFit="cover"
                    />
                    <Text style={styles.topBarName} numberOfLines={1}>{article.author_name}</Text>
                </View>
                <View style={styles.topBarRight}>
                    {!isOwnArticle && (
                        <TouchableOpacity
                            style={[styles.followButton, followed && styles.followButtonActive]}
                            onPress={handleFollow}
                        >
                            <Text style={[styles.followButtonText, followed && styles.followButtonTextActive]}>
                                {followed ? '已关注' : '+ 关注'}
                            </Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={openShareModal} style={styles.shareButton}>
                        <Ionicons name="share-outline" size={22} color={Colors.textPrimary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* 分享面板 — 蒙板 fade 渐显，面板 spring 滑入 */}
            <Modal
                visible={shareModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => closeShareModal()}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={() => closeShareModal()}
                    />
                    <Animated.View
                        style={[
                            styles.shareSheet,
                            {
                                transform: [{
                                    translateY: shareSlideAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [400, 0],
                                    }),
                                }],
                            },
                        ]}
                    >
                        <View style={styles.shareSheetHandle} />
                        <Text style={styles.shareSheetTitle}>分享至</Text>

                        <View style={styles.shareRow}>
                            {[
                                { icon: 'chatbubble-ellipses-outline' as const, label: '私信好友' },
                                { icon: 'logo-wechat' as const, label: '微信好友' },
                                { icon: 'ellipse' as const, label: '朋友圈' },
                            ].map((item) => (
                                <TouchableOpacity
                                    key={item.label}
                                    style={styles.shareItem}
                                    onPress={() => handleShareAction(item.label)}
                                >
                                    <View style={[
                                        styles.shareIconCircle,
                                        item.label === '微信好友' && { backgroundColor: '#07C160' },
                                        item.label === '朋友圈' && { backgroundColor: '#07C160' },
                                    ]}>
                                        {item.label === '朋友圈' ? (
                                            <Ionicons name="aperture-outline" size={24} color="#fff" />
                                        ) : (
                                            <Ionicons name={item.icon} size={24}
                                                color={item.label === '微信好友' ? '#fff' : Colors.textPrimary}
                                            />
                                        )}
                                    </View>
                                    <Text style={styles.shareItemText}>{item.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.shareRow}>
                            {[
                                { icon: 'link-outline' as const, label: '复制链接' },
                                { icon: 'download-outline' as const, label: '保存图片' },
                                { icon: 'image-outline' as const, label: '生成分享图' },
                            ].map((item) => (
                                <TouchableOpacity
                                    key={item.label}
                                    style={styles.shareItem}
                                    onPress={() => handleShareAction(item.label)}
                                >
                                    <View style={styles.shareIconCircle}>
                                        <Ionicons name={item.icon} size={24} color={Colors.textPrimary} />
                                    </View>
                                    <Text style={styles.shareItemText}>{item.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={styles.shareCancelButton}
                            onPress={() => closeShareModal()}
                        >
                            <Text style={styles.shareCancelText}>取消</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                {/* 滚动内容区 */}
                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                    {/* 图片轮播 */}
                    {article.images && article.images.length > 0 && (
                        <View>
                            <ScrollView
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                onScroll={onImageScroll}
                                scrollEventThrottle={16}
                            >
                                {article.images.map((img: any, index: number) => (
                                    <RemoteImage
                                        key={img.id || index}
                                        uri={img.image_url}
                                        style={styles.articleImage}
                                        contentFit="cover"
                                        recyclingKey={img.id != null ? String(img.id) : img.image_url}
                                    />
                                ))}
                            </ScrollView>
                            {article.images.length > 1 && (
                                <View style={styles.imageIndicator}>
                                    <Text style={styles.imageIndicatorText}>
                                        {currentImageIndex + 1}/{article.images.length}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* 标题 */}
                    <View style={styles.contentArea}>
                        <Text style={styles.articleTitle}>{article.title}</Text>
                        <Text style={styles.articleContent}>{article.content}</Text>

                        {article.topic ? (
                            <Text style={styles.topicTag}>#{article.topic}</Text>
                        ) : null}

                        <View style={styles.metaRow}>
                            <Text style={styles.metaText}>{formatTime(article.published_time)}</Text>
                            {location ? (
                                <>
                                    <Text style={styles.metaDot}>·</Text>
                                    <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
                                    <Text style={styles.metaText}>{location}</Text>
                                </>
                            ) : null}
                        </View>
                    </View>

                    {/* 分隔线 */}
                    <View style={styles.divider} />

                    {/* 评论区 */}
                    <View style={styles.commentSection}>
                        <Text style={styles.commentHeader}>
                            共 {article.comment_count || 0} 条评论
                        </Text>

                        {comments.length === 0 ? (
                            <View style={styles.emptyComment}>
                                <Text style={styles.emptyCommentText}>还没有评论，快来抢沙发</Text>
                            </View>
                        ) : (
                            comments.map((comment: any) => (
                                <View key={comment.id} style={styles.commentItem}>
                                    <RemoteImage
                                        uri={comment.author_avatar || 'https://picsum.photos/80/80'}
                                        style={styles.commentAvatar}
                                        contentFit="cover"
                                    />
                                    <View style={styles.commentBody}>
                                        <View style={styles.commentHeader2}>
                                            <Text style={styles.commentAuthor}>{comment.author_name}</Text>
                                            <TouchableOpacity
                                                style={styles.commentLikeBtn}
                                                onPress={() => handleCommentLike(comment.id, comment.liked, comment.like_count)}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Ionicons
                                                    name={comment.liked ? 'heart' : 'heart-outline'}
                                                    size={14}
                                                    color={comment.liked ? Colors.primary : Colors.textTertiary}
                                                />
                                                {comment.like_count > 0 && (
                                                    <Text style={[styles.commentLikeText, comment.liked && { color: Colors.primary }]}>
                                                        {formatCount(comment.like_count)}
                                                    </Text>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={styles.commentContent}>{comment.content}</Text>
                                        <Text style={styles.commentTime}>{formatTime(comment.created_time)}</Text>

                                        {comment.children && comment.children.length > 0 && (
                                            <View style={styles.childComments}>
                                                {comment.children.map((child: any) => (
                                                    <View key={child.id} style={styles.childCommentItem}>
                                                        <Text style={styles.childCommentText}>
                                                            <Text style={styles.childCommentAuthor}>
                                                                {child.author_name}
                                                            </Text>
                                                            {child.replied_username ? (
                                                                <Text style={styles.childCommentReply}>
                                                                    {' '}回复 <Text style={styles.childCommentAuthor}>
                                                                        {child.replied_username}
                                                                    </Text>
                                                                </Text>
                                                            ) : null}
                                                            {'：'}{child.content}
                                                        </Text>
                                                    </View>
                                                ))}
                                                {comment.child_comment_count > comment.children.length && !comment._expanded && (
                                                    <TouchableOpacity onPress={() => handleViewAllReplies(comment.id)}>
                                                        <Text style={styles.viewMoreReplies}>
                                                            查看全部 {comment.child_comment_count} 条回复
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </ScrollView>

                {/* 底部固定栏 */}
                <View style={styles.bottomBar}>
                    <View style={styles.inputWrapper}>
                        <TextInput
                            ref={inputRef}
                            style={styles.commentInput}
                            placeholder="说点什么..."
                            placeholderTextColor={Colors.textTertiary}
                            value={commentText}
                            onChangeText={setCommentText}
                            returnKeyType="send"
                            onSubmitEditing={handleSubmitComment}
                        />
                        {commentText.trim() ? (
                            <TouchableOpacity
                                onPress={handleSubmitComment}
                                disabled={submitting}
                                style={styles.sendButton}
                            >
                                <Text style={styles.sendButtonText}>
                                    {submitting ? '...' : '发送'}
                                </Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    <View style={styles.actionsRow}>
                        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
                            <Ionicons
                                name={liked ? 'heart' : 'heart-outline'}
                                size={22}
                                color={liked ? Colors.primary : Colors.textSecondary}
                            />
                            <Text style={[styles.actionCount, liked && { color: Colors.primary }]}>
                                {likeCount > 0 ? formatCount(likeCount) : '点赞'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionButton} onPress={handleFavorite}>
                            <Ionicons
                                name={favorited ? 'star' : 'star-outline'}
                                size={22}
                                color={favorited ? '#FFAA00' : Colors.textSecondary}
                            />
                            <Text style={[styles.actionCount, favorited && { color: '#FFAA00' }]}>
                                {favoriteCount > 0 ? formatCount(favoriteCount) : '收藏'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.backgroundWhite,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.backgroundWhite,
    },

    // 顶部栏
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm + 2,
        backgroundColor: Colors.backgroundWhite,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.border,
    },
    topBarLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    backButton: {
        padding: 4,
        marginRight: Spacing.sm,
    },
    topBarAvatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
    },
    topBarName: {
        marginLeft: Spacing.sm,
        fontSize: FontSize.sm,
        fontWeight: '600',
        color: Colors.textPrimary,
        maxWidth: 120,
    },
    topBarRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    followButton: {
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 14,
        backgroundColor: Colors.primary,
        marginRight: Spacing.sm,
    },
    followButtonActive: {
        backgroundColor: Colors.backgroundGray,
    },
    followButtonText: {
        fontSize: FontSize.xs,
        color: Colors.white,
        fontWeight: '600',
    },
    followButtonTextActive: {
        color: Colors.textSecondary,
    },
    shareButton: {
        padding: Spacing.sm,
    },

    // 分享面板
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    shareSheet: {
        backgroundColor: Colors.backgroundWhite,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        paddingTop: Spacing.sm,
    },
    shareSheetHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.borderDark,
        alignSelf: 'center',
        marginBottom: Spacing.md,
    },
    shareSheetTitle: {
        fontSize: FontSize.md,
        fontWeight: '600',
        color: Colors.textPrimary,
        textAlign: 'center',
        marginBottom: Spacing.lg,
    },
    shareRow: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.xl,
    },
    shareItem: {
        alignItems: 'center',
        width: 72,
    },
    shareIconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: Colors.backgroundGray,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    shareItemText: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
    },
    shareCancelButton: {
        marginHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderRadius: 8,
        backgroundColor: Colors.backgroundGray,
        alignItems: 'center',
    },
    shareCancelText: {
        fontSize: FontSize.md,
        color: Colors.textPrimary,
    },

    scrollView: {
        flex: 1,
    },

    // 图片
    articleImage: {
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH,
    },
    imageIndicator: {
        position: 'absolute',
        bottom: 12,
        right: 16,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    imageIndicatorText: {
        color: '#fff',
        fontSize: 12,
    },

    // 内容
    contentArea: {
        padding: Spacing.lg,
    },
    articleTitle: {
        fontSize: FontSize.xl,
        fontWeight: 'bold',
        color: Colors.textPrimary,
        lineHeight: 28,
        marginBottom: Spacing.md,
    },
    articleContent: {
        fontSize: FontSize.md,
        color: Colors.textPrimary,
        lineHeight: 24,
        marginBottom: Spacing.md,
    },
    topicTag: {
        color: '#4A90D9',
        fontSize: FontSize.sm,
        marginBottom: Spacing.md,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    metaText: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
    },
    metaDot: {
        marginHorizontal: 6,
        color: Colors.textTertiary,
    },

    divider: {
        height: 8,
        backgroundColor: Colors.background,
    },

    // 评论区
    commentSection: {
        padding: Spacing.lg,
    },
    commentHeader: {
        fontSize: FontSize.md,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: Spacing.lg,
    },
    emptyComment: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyCommentText: {
        color: Colors.textTertiary,
        fontSize: FontSize.sm,
    },
    commentItem: {
        flexDirection: 'row',
        marginBottom: Spacing.lg + 4,
    },
    commentAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: Spacing.md,
    },
    commentBody: {
        flex: 1,
    },
    commentHeader2: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    commentAuthor: {
        fontSize: FontSize.sm,
        fontWeight: '500',
        color: Colors.textSecondary,
    },
    commentLikeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    commentLikeText: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginLeft: 3,
    },
    commentContent: {
        fontSize: FontSize.md,
        color: Colors.textPrimary,
        lineHeight: 22,
    },
    commentTime: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginTop: 6,
    },
    childComments: {
        marginTop: Spacing.sm,
        backgroundColor: Colors.backgroundLightGray,
        borderRadius: Spacing.sm,
        padding: Spacing.md,
    },
    childCommentItem: {
        marginBottom: Spacing.sm,
    },
    childCommentText: {
        fontSize: FontSize.sm,
        color: Colors.textPrimary,
        lineHeight: 20,
    },
    childCommentAuthor: {
        color: '#4A90D9',
        fontWeight: '500',
    },
    childCommentReply: {
        color: Colors.textSecondary,
    },
    viewMoreReplies: {
        color: '#4A90D9',
        fontSize: FontSize.sm,
        marginTop: 4,
    },

    // 底部栏
    bottomBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm + 2,
        backgroundColor: Colors.backgroundWhite,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: Colors.border,
    },
    inputWrapper: {
        flex: 5,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.backgroundGray,
        borderRadius: 20,
        paddingHorizontal: Spacing.md,
        height: 36,
    },
    commentInput: {
        flex: 1,
        fontSize: FontSize.sm,
        color: Colors.textPrimary,
        padding: 0,
    },
    sendButton: {
        marginLeft: Spacing.sm,
    },
    sendButtonText: {
        color: Colors.primary,
        fontWeight: '600',
        fontSize: FontSize.sm,
    },
    actionsRow: {
        flex: 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    actionCount: {
        fontSize: 11,
        color: Colors.textSecondary,
        marginLeft: 2,
    },
});
