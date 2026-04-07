import { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    SafeAreaView, Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { buildApiUrl, API_ENDPOINTS } from '../../config/api';
import { Colors, Spacing, FontSize } from '../../config/styles';
import { useAuth } from '../../config/auth';
import { RemoteImage } from '../../components/RemoteImage';

type UnreadByType = { likes: number; follows: number; comments: number };

const NAV_BUTTONS = [
    { key: 'likes' as const, label: '赞和收藏', icon: 'heart', iconColor: Colors.primary },
    { key: 'follows' as const, label: '新增关注', icon: 'person', iconColor: '#4A90D9' },
    { key: 'comments' as const, label: '评论和@', icon: 'chatbubble-ellipses', iconColor: '#07C160' },
];

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

export default function MessageScreen() {
    const router = useRouter();
    const { userId, isLoggedIn } = useAuth();
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unreadByType, setUnreadByType] = useState<UnreadByType>({ likes: 0, follows: 0, comments: 0 });

    const fetchConversations = useCallback(async () => {
        if (!userId) return;
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATIONS, { user_id: userId, page: 1 }));
            const result = await response.json();
            if (result.code === 0) setConversations(result.data || []);
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

    useFocusEffect(useCallback(() => {
        if (!isLoggedIn) {
            router.replace('/login');
            return;
        }
        setLoading(true);
        fetchConversations();
        fetchUnreadByType();
    }, [isLoggedIn, fetchConversations, fetchUnreadByType]));

    const handleRefresh = () => {
        setRefreshing(true);
        fetchConversations();
        fetchUnreadByType();
    };

    const handleConversationPress = (conv: any) => {
        router.push(`/chat/${conv.id}?peer_id=${conv.user1_id === userId! ? conv.user2_id : conv.user1_id}` as any);
    };

    const renderConversationItem = ({ item }: { item: any }) => {
        const isUser1 = item.user1_id === userId!;
        const peerName = isUser1 ? item.user2_name : item.user1_name;
        const peerAvatar = isUser1 ? item.user2_avatar : item.user1_avatar;
        return (
            <TouchableOpacity style={s.convItem} onPress={() => handleConversationPress(item)}>
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
        );
    };

    return (
        <SafeAreaView style={s.container}>
            <View style={s.header}>
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
                    ListEmptyComponent={
                        <View style={s.center}>
                            <Ionicons name="chatbubbles-outline" size={48} color={Colors.borderDark} />
                            <Text style={s.emptyText}>暂无私信</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundWhite, paddingTop: Platform.OS === 'android' ? 25 : 0 },
    header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
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

    convItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
    convAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.backgroundGray, marginRight: Spacing.md },
    convBody: { flex: 1 },
    convHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    convName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
    convTime: { fontSize: FontSize.xs, color: Colors.textTertiary },
    convMsg: { fontSize: FontSize.sm, color: Colors.textSecondary },
    badge: { backgroundColor: Colors.primary, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, marginLeft: Spacing.sm },
    badgeText: { color: Colors.white, fontSize: 11, fontWeight: '600' },
});
