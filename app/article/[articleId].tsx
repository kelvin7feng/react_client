import { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Dimensions,
    Alert,
    Modal,
    Animated as RNAnimated,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from 'react-native';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useArticlePage } from '@/features/bff/hooks';
import { queryKeys } from '@/shared/query/keys';
import { BouncingDotsIndicator } from '@/components/BouncingDotsIndicator';
import {
    createComment,
    fetchChildComments as fetchChildCommentList,
    toggleArticleFavorite,
    toggleArticleLike as toggleArticleLikeRequest,
    toggleCommentLike as toggleCommentLikeRequest,
    deleteArticle,
    updateArticleVisibility,
} from '@/features/community/api';
import { toggleFollow } from '@/features/social/api';
import { API_BASE_URL } from '../../config/api';
import { Colors, Spacing, FontSize } from '../../config/styles';
import { EventBus, Events, LikeChangedPayload } from '../../config/events';
import { useAuth } from '../../config/auth';
import { formatCount, navigateToUserProfile } from '../../config/utils';
import { RemoteImage } from '../../components/RemoteImage';
import { ActionSheet } from '../../components/AlbumPicker';
import {
    VisibilityPicker,
    VISIBILITY_LABELS,
    VISIBILITY_CODE,
    type VisibilityOption,
} from '../../components/VisibilityPicker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ARTICLE_SLIDE_DURATION = 280;
const ARTICLE_CLOSE_DURATION = 200;
const DISMISS_THRESHOLD = SCREEN_WIDTH * 0.25;
const VELOCITY_THRESHOLD = 600;
const EDGE_ZONE_WIDTH = SCREEN_WIDTH * 0.35;

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
    const queryClient = useQueryClient();

    const numericArticleId = Number(articleId);
    const { data: pageData, isLoading: loading, refetch } = useArticlePage(numericArticleId, userId);

    const article = pageData?.article ?? null;

    const [comments, setComments] = useState<any[]>([]);
    const [likeOverride, setLikeOverride] = useState<{ liked: boolean; count: number } | null>(null);
    const [favOverride, setFavOverride] = useState<{ favorited: boolean; count: number } | null>(null);
    const [followOverride, setFollowOverride] = useState<boolean | null>(null);
    const [commentText, setCommentText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [shareModalVisible, setShareModalVisible] = useState(false);
    const [manageSheetVisible, setManageSheetVisible] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [visibilityPickerVisible, setVisibilityPickerVisible] = useState(false);
    const [articleVisibility, setArticleVisibility] = useState<VisibilityOption>('public');
    const shareSlideAnim = useRef(new RNAnimated.Value(0)).current;
    const deleteSlideAnim = useRef(new RNAnimated.Value(0)).current;
    const inputRef = useRef<TextInput>(null);
    const prevArticleIdRef = useRef<number | null>(null);
    const translateX = useSharedValue(SCREEN_WIDTH);
    const startX = useSharedValue(0);
    const animatingOut = useSharedValue(0);

    const finishClose = useCallback(() => {
        router.back();
    }, [router]);

    useEffect(() => {
        translateX.value = withTiming(0, { duration: ARTICLE_SLIDE_DURATION });
    }, [translateX]);

    const closeWithAnimation = useCallback(() => {
        if (animatingOut.value === 1) return;
        animatingOut.value = 1;
        translateX.value = withTiming(SCREEN_WIDTH, { duration: ARTICLE_CLOSE_DURATION }, () => {
            animatingOut.value = 0;
            runOnJS(finishClose)();
        });
    }, [animatingOut, finishClose, translateX]);

    const screenSlideStyle = useAnimatedStyle(() => {
        const progress = 1 - Math.min(Math.max(translateX.value / SCREEN_WIDTH, 0), 1);
        const opacity = (() => {
            if (animatingOut.value !== 1) {
                return 0.2 + progress * 0.8;
            }
            if (progress <= 0) {
                return 0;
            }
            if (progress <= 0.5) {
                return progress * 0.2;
            }
            return 0.1 + (progress - 0.5) * 1.8;
        })();
        return {
            transform: [{ translateX: translateX.value }],
            opacity,
        };
    });

    const backdropStyle = useAnimatedStyle(() => {
        const progress = 1 - Math.min(Math.max(translateX.value / SCREEN_WIDTH, 0), 1);
        return {
            opacity: progress * 0.12,
        };
    });

    const pan = Gesture.Pan()
        .activeOffsetX(20)
        .failOffsetY([-15, 15])
        .failOffsetX(-20)
        .manualActivation(true)
        .onTouchesDown((e) => {
            const touch = e.allTouches[0];
            startX.value = touch ? touch.x : 0;
        })
        .onTouchesMove((e, state) => {
            if (startX.value > EDGE_ZONE_WIDTH) {
                state.fail();
                return;
            }
            state.activate();
        })
        .onUpdate((e) => {
            const x = Math.max(0, e.translationX);
            translateX.value = x;
        })
        .onEnd((e) => {
            if (e.translationX > DISMISS_THRESHOLD || e.velocityX > VELOCITY_THRESHOLD) {
                animatingOut.value = 1;
                translateX.value = withTiming(SCREEN_WIDTH, { duration: ARTICLE_CLOSE_DURATION }, () => {
                    animatingOut.value = 0;
                    runOnJS(finishClose)();
                });
            } else {
                translateX.value = withTiming(0, { duration: ARTICLE_CLOSE_DURATION });
            }
        });

    const liked = likeOverride?.liked ?? article?.liked ?? false;
    const likeCount = likeOverride?.count ?? article?.like_count ?? 0;
    const favorited = favOverride?.favorited ?? article?.favorited ?? false;
    const favoriteCount = favOverride?.count ?? article?.favorite_count ?? 0;
    const followed = followOverride ?? article?.followed ?? false;

    useEffect(() => {
        if (!pageData) return;
        if (prevArticleIdRef.current !== pageData.article.id) {
            setLikeOverride(null);
            setFavOverride(null);
            setFollowOverride(null);
            prevArticleIdRef.current = pageData.article.id;
        }
        setComments(pageData.comments || []);
        const v = pageData.article.visibility;
        if (v === 1) setArticleVisibility('mutual');
        else if (v === 2) setArticleVisibility('private');
        else setArticleVisibility('public');
    }, [pageData]);

    const isOwnArticle = article?.author_id === userId;

    useEffect(() => {
        const off = EventBus.on(Events.FOLLOW_CHANGED, ({ userId: changedUserId, followed: newFollowed }: { userId: number; followed: boolean }) => {
            if (article?.author_id === changedUserId) {
                setFollowOverride(newFollowed);
            }
        });
        return off;
    }, [article?.author_id]);

    const handleLike = async () => {
        if (!isLoggedIn) { router.push('/login'); return; }
        const prevLiked = liked;
        const prevCount = likeCount;
        const newLiked = !liked;
        const newCount = liked ? likeCount - 1 : likeCount + 1;
        setLikeOverride({ liked: newLiked, count: newCount });

        try {
            await toggleArticleLikeRequest(Number(articleId));
            EventBus.emit(Events.ARTICLE_LIKE_CHANGED, {
                articleId: Number(articleId),
                liked: newLiked,
                likeCount: newCount,
            } as LikeChangedPayload);
        } catch {
            setLikeOverride({ liked: prevLiked, count: prevCount });
        }
    };

    const handleSubmitComment = async () => {
        if (!isLoggedIn) { router.push('/login'); return; }
        if (!commentText.trim()) return;
        setSubmitting(true);
        try {
            await createComment({
                articleId: Number(articleId),
                content: commentText.trim(),
            });
            setCommentText('');
            inputRef.current?.blur();
            await refetch();
        } catch {
            Alert.alert('评论失败', '网络错误');
        } finally {
            setSubmitting(false);
        }
    };

    const openShareModal = () => {
        setShareModalVisible(true);
        RNAnimated.spring(shareSlideAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
        }).start();
    };

    const closeShareModal = (cb?: () => void) => {
        RNAnimated.timing(shareSlideAnim, {
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
                if (article?.images && article.images.length > 0) {
                    try {
                        const { status } = await MediaLibrary.requestPermissionsAsync();
                        if (status !== 'granted') {
                            Alert.alert('提示', '需要相册权限');
                            return;
                        }
                        const imageUrl = article!.images[0].image_url;
                        if (!FileSystem.cacheDirectory) {
                            Alert.alert('失败', '无法访问缓存目录');
                            return;
                        }
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
        setFollowOverride(!prev);
        try {
            const result = await toggleFollow(article!.author_id, Number(userId));
            setFollowOverride(result.followed);
            EventBus.emit(Events.FOLLOW_CHANGED, { userId: article!.author_id, followed: result.followed });
        } catch {
            setFollowOverride(prev);
        }
    };

    const handleFavorite = async () => {
        if (!isLoggedIn) { router.push('/login'); return; }
        const prevFavorited = favorited;
        const prevCount = favoriteCount;
        const newFavorited = !favorited;
        const newCount = favorited ? favoriteCount - 1 : favoriteCount + 1;
        setFavOverride({ favorited: newFavorited, count: newCount });
        try {
            await toggleArticleFavorite(Number(articleId));
            EventBus.emit(Events.ARTICLE_FAVORITE_CHANGED, { articleId: Number(articleId), favorited: newFavorited });
        } catch {
            setFavOverride({ favorited: prevFavorited, count: prevCount });
        }
    };

    const openDeleteModal = () => {
        setDeleteModalVisible(true);
        RNAnimated.spring(deleteSlideAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
        }).start();
    };

    const closeDeleteModal = (cb?: () => void) => {
        RNAnimated.timing(deleteSlideAnim, {
            toValue: 0,
            duration: 120,
            useNativeDriver: true,
        }).start(() => {
            setDeleteModalVisible(false);
            cb?.();
        });
    };

    const handleEditArticle = () => {
        setManageSheetVisible(false);
        router.push({
            pathname: '/(tabs)/publish',
            params: {
                editArticleId: String(article!.id),
                editTitle: article!.title,
                editContent: article!.content,
                editTopic: article!.topic || '',
                editImages: JSON.stringify(article!.images?.map((img: any) => img.image_url) || []),
                editVisibility: String(article!.visibility ?? 0),
            },
        });
    };

    const handleOpenPermissions = () => {
        setManageSheetVisible(false);
        setVisibilityPickerVisible(true);
    };

    const handleVisibilityChange = async (next: VisibilityOption) => {
        const prev = articleVisibility;
        setArticleVisibility(next);
        try {
            await updateArticleVisibility(Number(articleId), VISIBILITY_CODE[next]);
            EventBus.emit(Events.ARTICLE_VISIBILITY_CHANGED, {
                articleId: Number(articleId),
                visibility: VISIBILITY_CODE[next],
            });
        } catch {
            setArticleVisibility(prev);
            Alert.alert('失败', '修改可见性失败');
        }
    };

    const handleOpenDeleteModal = () => {
        setManageSheetVisible(false);
        openDeleteModal();
    };

    const invalidateAfterDelete = () => {
        queryClient.invalidateQueries({ queryKey: ['myHome'] });
        queryClient.removeQueries({ queryKey: queryKeys.articlePage(Number(articleId), userId) });
    };

    const handleDeleteAndReEdit = () => {
        closeDeleteModal(() => {
            const imgs = article!.images?.map((img: any) => img.image_url) || [];
            deleteArticle(Number(articleId)).then(() => {
                EventBus.emit(Events.ARTICLE_DELETED, { articleId: Number(articleId) });
                invalidateAfterDelete();
                router.replace({
                    pathname: '/(tabs)/publish',
                    params: {
                        editTitle: article!.title,
                        editContent: article!.content,
                        editTopic: article!.topic || '',
                        editImages: JSON.stringify(imgs),
                    },
                });
            }).catch(() => {
                Alert.alert('失败', '删除失败');
            });
        });
    };

    const handleSetPrivate = async () => {
        closeDeleteModal(async () => {
            const prev = articleVisibility;
            setArticleVisibility('private');
            try {
                await updateArticleVisibility(Number(articleId), VISIBILITY_CODE.private);
                EventBus.emit(Events.ARTICLE_VISIBILITY_CHANGED, {
                    articleId: Number(articleId),
                    visibility: VISIBILITY_CODE.private,
                });
            } catch {
                setArticleVisibility(prev);
                Alert.alert('失败', '修改可见性失败');
            }
        });
    };

    const handleDeleteArticle = () => {
        closeDeleteModal(() => {
            deleteArticle(Number(articleId)).then(() => {
                EventBus.emit(Events.ARTICLE_DELETED, { articleId: Number(articleId) });
                invalidateAfterDelete();
                router.back();
            }).catch(() => {
                Alert.alert('失败', '删除失败');
            });
        });
    };

    const visibilityIcon = articleVisibility === 'public'
        ? 'lock-open-outline' as const
        : articleVisibility === 'mutual'
            ? 'people-outline' as const
            : 'lock-closed-outline' as const;

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
            await toggleCommentLikeRequest(commentId);
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
            const result = await fetchChildCommentList(parentId, 1);
            setComments(prev => prev.map(c =>
                c.id === parentId ? { ...c, children: result, _expanded: true } : c
            ));
        } catch {}
    };

    const onImageScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        setCurrentImageIndex(index);
    };

    const renderScreen = () => {
        if (loading && !article) {
            return (
                <SafeAreaView style={styles.loadingContainer}>
                    <BouncingDotsIndicator mode="inline" size={28} color={Colors.primary} />
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
                    <TouchableOpacity onPress={closeWithAnimation} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.topBarAuthor}
                        onPress={() => navigateToUserProfile(router, article.author_id, userId)}
                        activeOpacity={0.7}
                    >
                        <RemoteImage
                            uri={article.author_avatar || 'https://picsum.photos/100/100'}
                            style={styles.topBarAvatar}
                            contentFit="cover"
                        />
                        <Text style={styles.topBarName} numberOfLines={1}>{article.author_name}</Text>
                    </TouchableOpacity>
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
                    <RNAnimated.View
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
                    </RNAnimated.View>
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
                            <Text style={styles.metaText}>{formatTime(article.published_time || '')}</Text>
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
                                    <TouchableOpacity onPress={() => navigateToUserProfile(router, comment.author_id, userId)} activeOpacity={0.7}>
                                        <RemoteImage
                                            uri={comment.author_avatar || 'https://picsum.photos/80/80'}
                                            style={styles.commentAvatar}
                                            contentFit="cover"
                                        />
                                    </TouchableOpacity>
                                    <View style={styles.commentBody}>
                                        <View style={styles.commentHeader2}>
                                            <TouchableOpacity onPress={() => navigateToUserProfile(router, comment.author_id, userId)} activeOpacity={0.7}>
                                                <Text style={styles.commentAuthor}>{comment.author_name}</Text>
                                            </TouchableOpacity>
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
                    {isOwnArticle && (
                        <TouchableOpacity style={styles.manageButton} onPress={() => setManageSheetVisible(true)}>
                            <Ionicons name={visibilityIcon} size={18} color={Colors.textSecondary} />
                            <Text style={styles.manageVisibilityText} numberOfLines={1}>
                                {VISIBILITY_LABELS[articleVisibility]}
                            </Text>
                            <Text style={styles.manageSubText}>编辑和权限设置</Text>
                        </TouchableOpacity>
                    )}
                    <View style={[styles.inputWrapper, isOwnArticle && { flex: 4 }]}>
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

                    <View style={[styles.actionsRow, isOwnArticle && { flex: 3 }]}>
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

            {/* 管理操作面板 */}
            <ActionSheet
                visible={manageSheetVisible}
                onClose={() => setManageSheetVisible(false)}
                options={[
                    { label: '编辑', onPress: handleEditArticle },
                    { label: '权限设置', onPress: handleOpenPermissions },
                    { label: '删除', onPress: handleOpenDeleteModal, destructive: true },
                ]}
            />

            {/* 删除确认面板 */}
            <Modal
                visible={deleteModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => closeDeleteModal()}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={() => closeDeleteModal()}
                    />
                    <RNAnimated.View
                        style={[
                            styles.deleteSheet,
                            {
                                transform: [{
                                    translateY: deleteSlideAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [400, 0],
                                    }),
                                }],
                            },
                        ]}
                    >
                        <View style={styles.deleteTopSection}>
                            <TouchableOpacity style={styles.deleteOption} onPress={handleDeleteAndReEdit}>
                                <Text style={styles.deleteOptionText}>删除并重新编辑</Text>
                            </TouchableOpacity>
                            <View style={styles.deleteThinDivider} />
                            <TouchableOpacity style={styles.deleteOption} onPress={handleSetPrivate}>
                                <Text style={styles.deleteOptionText}>仅自己可见</Text>
                            </TouchableOpacity>
                            <View style={styles.deleteThinDivider} />
                            <TouchableOpacity style={styles.deleteOption} onPress={handleDeleteArticle}>
                                <Text style={[styles.deleteOptionText, { color: '#FF3B30' }]}>删除笔记</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.deleteGap} />
                        <View style={styles.deleteBottomSection}>
                            <TouchableOpacity style={styles.deleteOption} onPress={() => closeDeleteModal()}>
                                <Text style={styles.deleteCancelText}>取消</Text>
                            </TouchableOpacity>
                        </View>
                    </RNAnimated.View>
                </View>
            </Modal>

            {/* 权限设置 */}
            <VisibilityPicker
                visible={visibilityPickerVisible}
                value={articleVisibility}
                allowedCount={0}
                deniedCount={0}
                onClose={() => setVisibilityPickerVisible(false)}
                onChange={handleVisibilityChange}
                onOpenAllowed={() => {}}
                onOpenDenied={() => {}}
                hideTitle
                hideFooter
            />
        </SafeAreaView>
        );
    };

    return (
        <View style={styles.routeRoot}>
            <Animated.View pointerEvents="none" style={[styles.backdrop, backdropStyle]} />
            <GestureDetector gesture={pan}>
                <Animated.View style={[styles.screenFrame, screenSlideStyle]}>
                    {renderScreen()}
                </Animated.View>
            </GestureDetector>
        </View>
    );
}

const styles = StyleSheet.create({
    routeRoot: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.black,
    },
    screenFrame: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.backgroundWhite,
    },
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
    topBarAuthor: {
        flexDirection: 'row',
        alignItems: 'center',
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

    // 管理按钮（底部栏左侧）
    manageButton: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingRight: Spacing.sm,
        marginRight: Spacing.xs,
    },
    manageVisibilityText: {
        fontSize: 10,
        color: Colors.textSecondary,
        marginTop: 1,
        maxWidth: 60,
    },
    manageSubText: {
        fontSize: 9,
        color: Colors.textTertiary,
        marginTop: 1,
    },

    // 删除确认面板
    deleteSheet: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    deleteTopSection: {
        backgroundColor: Colors.backgroundWhite,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
    },
    deleteThinDivider: {
        height: 2,
        backgroundColor: '#F0F0F0',
    },
    deleteGap: {
        height: 8,
        backgroundColor: '#E8E8E8',
    },
    deleteBottomSection: {
        backgroundColor: Colors.backgroundWhite,
    },
    deleteOption: {
        minHeight: 56,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.lg,
    },
    deleteOptionText: {
        fontSize: FontSize.md + 1,
        color: Colors.textPrimary,
    },
    deleteCancelText: {
        fontSize: FontSize.md + 1,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
});
