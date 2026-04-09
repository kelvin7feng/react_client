import { useState, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Platform, ActivityIndicator, RefreshControl, Alert, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    useSharedValue, useAnimatedStyle, withTiming, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { buildApiUrl, API_BASE_URL, API_ENDPOINTS } from '../../config/api';
import { Colors, Spacing, FontSize } from '../../config/styles';
import { useAuth } from '../../config/auth';
import { RemoteImage } from '../../components/RemoteImage';
import { openChat, preloadSessions } from '../../config/chatManager';
import { useWSEvent } from '../../config/useWebSocket';

type UnreadByType = { likes: number; follows: number; comments: number };

const NAV_BUTTONS = [
    { key: 'likes' as const, label: '赞和收藏', icon: 'heart', iconColor: Colors.primary },
    { key: 'follows' as const, label: '新增关注', icon: 'person', iconColor: '#4A90D9' },
    { key: 'comments' as const, label: '评论和@', icon: 'chatbubble-ellipses', iconColor: '#07C160' },
];

const ACTION_BTN_WIDTH = 72;
const TOTAL_ACTION_WIDTH = ACTION_BTN_WIDTH * 2;
const SNAP_THRESHOLD = TOTAL_ACTION_WIDTH * 0.4;

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
    } catch { return timeStr; }
};

function SwipeableConversationItem({
    item, userId, router,
    onPin, onDelete, activeSwipeId, setActiveSwipeId,
}: {
    item: any; userId: number; router: any;
    onPin: (conv: any) => void; onDelete: (conv: any) => void;
    activeSwipeId: string | null; setActiveSwipeId: (id: string | null) => void;
}) {
    const translateX = useSharedValue(0);
    const savedX = useSharedValue(0);
    const isOpen = useSharedValue(false);

    const closeSwipe = useCallback(() => {
        translateX.value = withTiming(0, { duration: 200 });
        savedX.value = 0;
        isOpen.value = false;
    }, []);

    const itemId = String(item.id);

    const previousActiveRef = useRef(activeSwipeId);
    if (previousActiveRef.current !== activeSwipeId) {
        previousActiveRef.current = activeSwipeId;
        if (activeSwipeId !== itemId && isOpen.value) {
            closeSwipe();
        }
    }

    const handlePress = useCallback(() => {
        if (isOpen.value) {
            closeSwipe();
            return;
        }
        const peerId = item.user1_id === userId ? item.user2_id : item.user1_id;
        openChat(String(item.id), peerId);
    }, [item, userId]);

    const handlePinPress = useCallback(() => {
        closeSwipe();
        setActiveSwipeId(null);
        onPin(item);
    }, [item, onPin]);

    const handleDeletePress = useCallback(() => {
        closeSwipe();
        setActiveSwipeId(null);
        onDelete(item);
    }, [item, onDelete]);

    const pan = Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-5, 5])
        .onStart(() => {
            savedX.value = translateX.value;
        })
        .onUpdate((e) => {
            const newX = savedX.value + e.translationX;
            translateX.value = Math.max(-TOTAL_ACTION_WIDTH, Math.min(0, newX));
        })
        .onEnd((e) => {
            if (savedX.value === 0) {
                if (translateX.value < -SNAP_THRESHOLD || e.velocityX < -500) {
                    translateX.value = withTiming(-TOTAL_ACTION_WIDTH, { duration: 200 });
                    savedX.value = -TOTAL_ACTION_WIDTH;
                    isOpen.value = true;
                    runOnJS(setActiveSwipeId)(itemId);
                } else {
                    translateX.value = withTiming(0, { duration: 200 });
                    savedX.value = 0;
                    isOpen.value = false;
                }
            } else {
                if (translateX.value > -(TOTAL_ACTION_WIDTH - SNAP_THRESHOLD) || e.velocityX > 500) {
                    translateX.value = withTiming(0, { duration: 200 });
                    savedX.value = 0;
                    isOpen.value = false;
                    runOnJS(setActiveSwipeId)(null);
                } else {
                    translateX.value = withTiming(-TOTAL_ACTION_WIDTH, { duration: 200 });
                    savedX.value = -TOTAL_ACTION_WIDTH;
                    isOpen.value = true;
                }
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const isUser1 = item.user1_id === userId;
    const peerId = isUser1 ? item.user2_id : item.user1_id;
    const peerName = isUser1 ? item.user2_name : item.user1_name;
    const peerAvatar = isUser1 ? item.user2_avatar : item.user1_avatar;
    const isPinned = item.is_pinned;

    return (
        <View style={s.swipeContainer}>
            <View style={s.actionsContainer}>
                <TouchableOpacity
                    style={[s.actionBtn, s.pinBtn]}
                    onPress={handlePinPress}
                    activeOpacity={0.8}
                >
                    <Ionicons name={isPinned ? 'arrow-down' : 'arrow-up'} size={20} color="#fff" />
                    <Text style={s.actionText}>{isPinned ? '取消置顶' : '置顶'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[s.actionBtn, s.deleteBtn]}
                    onPress={handleDeletePress}
                    activeOpacity={0.8}
                >
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                    <Text style={s.actionText}>删除</Text>
                </TouchableOpacity>
            </View>

            <GestureDetector gesture={pan}>
                <Animated.View style={[s.convItemWrapper, animatedStyle]}>
                    <TouchableOpacity
                        style={[s.convItem, isPinned && s.pinnedItem]}
                        onPress={handlePress}
                        activeOpacity={0.7}
                    >
                        <RemoteImage uri={peerAvatar || 'https://picsum.photos/80/80'} style={s.convAvatar} contentFit="cover" />
                        <View style={s.convBody}>
                            <View style={s.convHeader}>
                                <Text style={s.convName} numberOfLines={1}>{peerName}</Text>
                                <Text style={s.convTime}>{formatTime(item.last_message_time)}</Text>
                            </View>
                            <Text style={s.convMsg} numberOfLines={1}>{item.last_message || '暂无消息'}</Text>
                        </View>
                        {item.unread_count > 0 && (
                            <View style={s.badge}><Text style={s.badgeText}>{item.unread_count > 99 ? '99+' : item.unread_count}</Text></View>
                        )}
                    </TouchableOpacity>
                </Animated.View>
            </GestureDetector>
        </View>
    );
}

export default function MessageScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { userId, isLoggedIn } = useAuth();
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unreadByType, setUnreadByType] = useState<UnreadByType>({ likes: 0, follows: 0, comments: 0 });
    const [activeSwipeId, setActiveSwipeId] = useState<string | null>(null);

    const fetchConversations = useCallback(async (showLoading = false) => {
        if (!userId) return;
        if (showLoading) setLoading(true);
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATIONS, { user_id: userId, page: 1 }));
            const result = await response.json();
            if (result.code === 0) {
                const data = result.data || [];
                setConversations(data);
                preloadSessions(data.map((c: any) => ({
                    conversationId: String(c.id),
                    peerId: c.user1_id === userId ? c.user2_id : c.user1_id,
                })));
            }
        } catch {} finally { setLoading(false); setRefreshing(false); }
    }, [userId]);

    const fetchUnreadByType = useCallback(async () => {
        if (!userId) return;
        try {
            const res = await fetch(buildApiUrl(API_ENDPOINTS.UNREAD_COUNT, { user_id: userId }));
            const json = await res.json();
            if (json.code === 0) {
                setUnreadByType({
                    likes: json.data?.likes || 0,
                    follows: json.data?.follows || 0,
                    comments: json.data?.comments || 0,
                });
            }
        } catch {}
    }, [userId]);

    const hasLoadedRef = useRef(false);

    useFocusEffect(useCallback(() => {
        if (!isLoggedIn) {
            router.replace('/login');
            return;
        }
        fetchConversations(!hasLoadedRef.current);
        fetchUnreadByType();
        hasLoadedRef.current = true;
    }, [isLoggedIn, fetchConversations, fetchUnreadByType]));

    useWSEvent('new_message', useCallback(async () => {
        if (!userId) return;
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATIONS, { user_id: userId, page: 1 }));
            const result = await response.json();
            if (result.code === 0) {
                const data = result.data || [];
                setConversations(data);
                preloadSessions(data.map((c: any) => ({
                    conversationId: String(c.id),
                    peerId: c.user1_id === userId ? c.user2_id : c.user1_id,
                })));
            }
        } catch {}
    }, [userId]));

    const handleRefresh = () => {
        setRefreshing(true);
        setActiveSwipeId(null);
        fetchConversations();
        fetchUnreadByType();
    };

    const handleTogglePin = useCallback(async (conv: any) => {
        try {
            const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.TOGGLE_CONVERSATION_PIN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversation_id: conv.id, user_id: Number(userId) }),
            });
            const json = await res.json();
            if (json.code === 0) {
                fetchConversations();
            }
        } catch {}
    }, [userId, fetchConversations]);

    const handleDelete = useCallback((conv: any) => {
        const isUser1 = conv.user1_id === userId;
        const peerName = isUser1 ? conv.user2_name : conv.user1_name;
        Alert.alert(
            '删除会话',
            `确定删除与 ${peerName} 的会话吗？聊天记录将一并删除。`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '删除', style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.DELETE_CONVERSATION}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ conversation_id: conv.id, user_id: Number(userId) }),
                            });
                            const json = await res.json();
                            if (json.code === 0) {
                                setConversations(prev => prev.filter(c => c.id !== conv.id));
                            }
                        } catch {}
                    },
                },
            ],
        );
    }, [userId]);

    const renderConversationItem = useCallback(({ item }: { item: any }) => (
        <SwipeableConversationItem
            item={item}
            userId={userId!}
            router={router}
            onPin={handleTogglePin}
            onDelete={handleDelete}
            activeSwipeId={activeSwipeId}
            setActiveSwipeId={setActiveSwipeId}
        />
    ), [userId, handleTogglePin, handleDelete, activeSwipeId]);

    return (
        <View style={s.container}>
            <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
                <Text style={s.headerTitle}>消息</Text>
            </View>

            <View style={s.navBar}>
                {NAV_BUTTONS.map(btn => {
                    const count = unreadByType[btn.key] || 0;
                    return (
                        <TouchableOpacity
                            key={btn.key}
                            style={s.navBtn}
                            activeOpacity={0.7}
                            onPress={() => router.push(`/notifications?type=${btn.key}`)}
                        >
                            <View style={s.navIconWrap}>
                                <Ionicons name={btn.icon as any} size={22} color={btn.iconColor} />
                                {count > 0 && (
                                    <View style={s.navBadge}>
                                        <Text style={s.navBadgeText}>{count > 99 ? '99+' : count}</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={s.navLabel}>{btn.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {loading ? (
                <View style={s.center}><ActivityIndicator size="small" color={Colors.textTertiary} /></View>
            ) : (
                <FlatList
                    data={conversations}
                    renderItem={renderConversationItem}
                    keyExtractor={item => String(item.id)}
                    contentContainerStyle={conversations.length === 0 ? s.emptyList : undefined}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                    onScrollBeginDrag={() => { if (activeSwipeId) setActiveSwipeId(null); }}
                    ListEmptyComponent={
                        <View style={s.center}>
                            <Ionicons name="chatbubbles-outline" size={48} color={Colors.borderDark} />
                            <Text style={s.emptyText}>暂无私信</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundWhite },
    header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, alignItems: 'center', backgroundColor: Colors.backgroundWhite },
    headerTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.textPrimary },

    navBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: Spacing.lg, paddingHorizontal: Spacing.lg },
    navBtn: { alignItems: 'center', flex: 1 },
    navIconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: Colors.backgroundGray, justifyContent: 'center', alignItems: 'center', position: 'relative' as const },
    navBadge: { position: 'absolute' as const, top: -4, right: -6, backgroundColor: '#ff2442', borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center' as const, alignItems: 'center' as const, paddingHorizontal: 4, borderWidth: 1.5, borderColor: Colors.backgroundWhite },
    navBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' as const },
    navLabel: { marginTop: Spacing.xs, fontSize: FontSize.xs, color: Colors.textSecondary },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
    emptyList: { flexGrow: 1 },
    emptyText: { marginTop: Spacing.md, fontSize: FontSize.sm, color: Colors.textTertiary },

    swipeContainer: { overflow: 'hidden' },
    actionsContainer: {
        position: 'absolute', right: 0, top: 0, bottom: 0,
        flexDirection: 'row', width: TOTAL_ACTION_WIDTH,
    },
    actionBtn: {
        width: ACTION_BTN_WIDTH, justifyContent: 'center', alignItems: 'center',
    },
    pinBtn: { backgroundColor: '#4A90D9' },
    deleteBtn: { backgroundColor: Colors.primary },
    actionText: { color: '#fff', fontSize: 11, marginTop: 2, fontWeight: '500' },

    convItemWrapper: { backgroundColor: Colors.backgroundWhite },
    convItem: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
        backgroundColor: Colors.backgroundWhite,
    },
    pinnedItem: { backgroundColor: '#f7f8fa' },
    convAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.backgroundGray, marginRight: Spacing.md },
    convBody: { flex: 1 },
    convHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    convName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
    convTime: { fontSize: FontSize.xs, color: Colors.textTertiary },
    convMsg: { fontSize: FontSize.sm, color: Colors.textSecondary },
    badge: { backgroundColor: Colors.primary, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, marginLeft: Spacing.sm },
    badgeText: { color: Colors.white, fontSize: 11, fontWeight: '600' },
});
