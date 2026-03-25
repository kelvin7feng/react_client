import { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
    SafeAreaView, Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { buildApiUrl, API_ENDPOINTS, API_BASE_URL } from '../../config/api';
import { Colors, Spacing, FontSize } from '../../config/styles';
import { useAuth } from '../../config/auth';

const MSG_TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
    like: { icon: 'heart', color: Colors.primary, label: '赞了你的笔记' },
    comment: { icon: 'chatbubble', color: '#4A90D9', label: '评论了你的笔记' },
    follow: { icon: 'person-add', color: '#07C160', label: '关注了你' },
    favorite: { icon: 'star', color: '#FFAA00', label: '收藏了你的笔记' },
    system: { icon: 'notifications', color: Colors.textSecondary, label: '系统通知' },
};

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
    const [messages, setMessages] = useState<any[]>([]);
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [tab, setTab] = useState<'notifications' | 'chats'>('notifications');

    const fetchMessages = useCallback(async () => {
        if (!userId) return;
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.MESSAGES, { user_id: userId, page: 1 }));
            const result = await response.json();
            if (result.code === 0) setMessages(result.data || []);
        } catch {} finally { setLoading(false); setRefreshing(false); }
    }, [userId]);

    const fetchConversations = useCallback(async () => {
        if (!userId) return;
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATIONS, { user_id: userId, page: 1 }));
            const result = await response.json();
            if (result.code === 0) setConversations(result.data || []);
        } catch {} finally { setLoading(false); setRefreshing(false); }
    }, [userId]);

    useFocusEffect(useCallback(() => {
        setLoading(true);
        if (tab === 'notifications') fetchMessages();
        else fetchConversations();
    }, [tab, fetchMessages, fetchConversations]));

    const handleRefresh = () => {
        setRefreshing(true);
        if (tab === 'notifications') fetchMessages();
        else fetchConversations();
    };

    const markAllRead = async () => {
        try {
            await fetch(`${API_BASE_URL}${API_ENDPOINTS.READ_ALL_MESSAGES}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId! }),
            });
            setMessages(prev => prev.map(m => ({ ...m, is_read: true })));
        } catch {}
    };

    const handleMessagePress = (msg: any) => {
        if (!msg.is_read) {
            fetch(`${API_BASE_URL}${API_ENDPOINTS.READ_MESSAGE}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message_id: msg.id, user_id: userId! }),
            });
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
        }
        if (msg.related_id && (msg.type === 'like' || msg.type === 'comment' || msg.type === 'favorite')) {
            router.push(`/article/${msg.related_id}`);
        }
    };

    const handleConversationPress = (conv: any) => {
        router.push(`/chat/${conv.id}?peer_id=${conv.user1_id === userId! ? conv.user2_id : conv.user1_id}` as any);
    };

    const renderMessageItem = ({ item }: { item: any }) => {
        const cfg = MSG_TYPE_CONFIG[item.type] || MSG_TYPE_CONFIG.system;
        return (
            <TouchableOpacity style={[s.msgItem, !item.is_read && s.msgUnread]} onPress={() => handleMessagePress(item)}>
                <View style={s.msgIconWrap}>
                    <Image source={{ uri: item.sender_avatar || 'https://picsum.photos/80/80' }} style={s.msgAvatar} />
                    <View style={[s.msgTypeBadge, { backgroundColor: cfg.color }]}>
                        <Ionicons name={cfg.icon as any} size={10} color="#fff" />
                    </View>
                </View>
                <View style={s.msgBody}>
                    <View style={s.msgHeader}>
                        <Text style={s.msgSender} numberOfLines={1}>{item.sender_name}</Text>
                        <Text style={s.msgTime}>{formatTime(item.created_time)}</Text>
                    </View>
                    <Text style={s.msgContent} numberOfLines={2}>{cfg.label}{item.content ? `：${item.content}` : ''}</Text>
                </View>
                {!item.is_read && <View style={s.unreadDot} />}
            </TouchableOpacity>
        );
    };

    const renderConversationItem = ({ item }: { item: any }) => {
        const isUser1 = item.user1_id === userId!;
        const peerName = isUser1 ? item.user2_name : item.user1_name;
        const peerAvatar = isUser1 ? item.user2_avatar : item.user1_avatar;
        return (
            <TouchableOpacity style={s.convItem} onPress={() => handleConversationPress(item)}>
                <Image source={{ uri: peerAvatar || 'https://picsum.photos/80/80' }} style={s.convAvatar} />
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

    const unreadCount = messages.filter(m => !m.is_read).length;

    return (
        <SafeAreaView style={s.container}>
            <View style={s.header}>
                <Text style={s.headerTitle}>消息</Text>
                {tab === 'notifications' && unreadCount > 0 && (
                    <TouchableOpacity onPress={markAllRead}>
                        <Text style={s.markAllRead}>全部已读</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={s.tabs}>
                <TouchableOpacity style={[s.tab, tab === 'notifications' && s.tabActive]}
                    onPress={() => setTab('notifications')}>
                    <Text style={[s.tabText, tab === 'notifications' && s.tabTextActive]}>通知</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.tab, tab === 'chats' && s.tabActive]}
                    onPress={() => setTab('chats')}>
                    <Text style={[s.tabText, tab === 'chats' && s.tabTextActive]}>私信</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={s.center}><ActivityIndicator size="small" color={Colors.textTertiary} /></View>
            ) : tab === 'notifications' ? (
                <FlatList data={messages} renderItem={renderMessageItem} keyExtractor={item => String(item.id)}
                    contentContainerStyle={messages.length === 0 ? s.emptyList : undefined}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                    ListEmptyComponent={<View style={s.center}><Ionicons name="notifications-off-outline" size={48} color={Colors.borderDark} /><Text style={s.emptyText}>暂无通知</Text></View>}
                />
            ) : (
                <FlatList data={conversations} renderItem={renderConversationItem} keyExtractor={item => String(item.id)}
                    contentContainerStyle={conversations.length === 0 ? s.emptyList : undefined}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                    ListEmptyComponent={<View style={s.center}><Ionicons name="chatbubbles-outline" size={48} color={Colors.borderDark} /><Text style={s.emptyText}>暂无私信</Text></View>}
                />
            )}
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundWhite, paddingTop: Platform.OS === 'android' ? 25 : 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    headerTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.textPrimary },
    markAllRead: { fontSize: FontSize.sm, color: Colors.primary },
    tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border, paddingHorizontal: Spacing.lg },
    tab: { paddingVertical: Spacing.md, marginRight: Spacing.xl },
    tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
    tabText: { fontSize: FontSize.md, color: Colors.textSecondary },
    tabTextActive: { color: Colors.textPrimary, fontWeight: '600' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
    emptyList: { flexGrow: 1 },
    emptyText: { marginTop: Spacing.md, fontSize: FontSize.sm, color: Colors.textTertiary },

    msgItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
    msgUnread: { backgroundColor: '#f0f8ff' },
    msgIconWrap: { position: 'relative', marginRight: Spacing.md },
    msgAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.backgroundGray },
    msgTypeBadge: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.backgroundWhite },
    msgBody: { flex: 1 },
    msgHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    msgSender: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, flex: 1, marginRight: Spacing.sm },
    msgTime: { fontSize: FontSize.xs, color: Colors.textTertiary },
    msgContent: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginLeft: Spacing.sm },

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
