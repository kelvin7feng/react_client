import { useState, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    SafeAreaView, Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { buildApiUrl, API_ENDPOINTS, API_BASE_URL } from '../config/api';
import { Colors, Spacing, FontSize } from '../config/styles';
import { useAuth } from '../config/auth';
import { navigateToUserProfile } from '../config/utils';
import { RemoteImage } from '../components/RemoteImage';

type NotificationType = 'likes' | 'follows' | 'comments';

const PAGE_CONFIG: Record<NotificationType, { title: string; filterTypes: string[]; emptyIcon: string; emptyText: string }> = {
    likes: { title: '赞和收藏', filterTypes: ['like', 'favorite'], emptyIcon: 'heart-outline', emptyText: '暂无赞和收藏' },
    follows: { title: '新增关注', filterTypes: ['follow'], emptyIcon: 'person-add-outline', emptyText: '暂无新增关注' },
    comments: { title: '评论和@', filterTypes: ['comment'], emptyIcon: 'chatbubble-outline', emptyText: '暂无评论和@' },
};

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

export default function NotificationsScreen() {
    const router = useRouter();
    const { type } = useLocalSearchParams<{ type: NotificationType }>();
    const { userId } = useAuth();
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const hasFetched = useRef(false);

    const config = PAGE_CONFIG[type as NotificationType] || PAGE_CONFIG.likes;

    const fetchMessages = useCallback(async (showLoading = false) => {
        if (!userId) return;
        if (showLoading) setLoading(true);
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.MESSAGES, { user_id: userId, page: 1 }));
            const result = await response.json();
            if (result.code === 0) {
                const filtered = (result.data || []).filter((m: any) => config.filterTypes.includes(m.type));
                setMessages(filtered);
            }
        } catch {} finally { setLoading(false); setRefreshing(false); }
    }, [userId, config.filterTypes]);

    useFocusEffect(useCallback(() => {
        if (!hasFetched.current) {
            hasFetched.current = true;
            fetchMessages(true);
        }
    }, [fetchMessages]));

    const handleRefresh = () => {
        setRefreshing(true);
        fetchMessages();
    };

    const unreadCount = messages.filter(m => !m.is_read).length;

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
        if (msg.type === 'follow') return;
        if (msg.related_id) router.push(`/article/${msg.related_id}`);
    };

    const renderItem = ({ item }: { item: any }) => {
        const cfg = MSG_TYPE_CONFIG[item.type] || MSG_TYPE_CONFIG.system;
        return (
            <TouchableOpacity style={[s.msgItem, !item.is_read && s.msgUnread]} onPress={() => handleMessagePress(item)}>
                <TouchableOpacity
                    style={s.msgIconWrap}
                    onPress={() => item.sender_id && navigateToUserProfile(router, item.sender_id, userId ?? null)}
                    activeOpacity={0.7}
                >
                    <RemoteImage uri={item.sender_avatar || 'https://picsum.photos/80/80'} style={s.msgAvatar} contentFit="cover" />
                    <View style={[s.msgTypeBadge, { backgroundColor: cfg.color }]}>
                        <Ionicons name={cfg.icon as any} size={10} color="#fff" />
                    </View>
                </TouchableOpacity>
                <View style={s.msgBody}>
                    <View style={s.msgHeader}>
                        <TouchableOpacity
                            onPress={() => item.sender_id && navigateToUserProfile(router, item.sender_id, userId ?? null)}
                            activeOpacity={0.7}
                        >
                            <Text style={s.msgSender} numberOfLines={1}>{item.sender_name}</Text>
                        </TouchableOpacity>
                        <Text style={s.msgTime}>{formatTime(item.created_time)}</Text>
                    </View>
                    <Text style={s.msgContent} numberOfLines={2}>{cfg.label}{item.content ? `：${item.content}` : ''}</Text>
                </View>
                {!item.is_read && <View style={s.unreadDot} />}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={s.container}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>{config.title}</Text>
                {unreadCount > 0 ? (
                    <TouchableOpacity onPress={markAllRead}>
                        <Text style={s.markAllRead}>全部已读</Text>
                    </TouchableOpacity>
                ) : <View style={s.headerRight} />}
            </View>

            {loading ? (
                <View style={s.center}><ActivityIndicator size="small" color={Colors.textTertiary} /></View>
            ) : (
                <FlatList
                    data={messages}
                    renderItem={renderItem}
                    keyExtractor={item => String(item.id)}
                    contentContainerStyle={messages.length === 0 ? s.emptyList : undefined}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                    ListEmptyComponent={
                        <View style={s.center}>
                            <Ionicons name={config.emptyIcon as any} size={48} color={Colors.borderDark} />
                            <Text style={s.emptyText}>{config.emptyText}</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundWhite, paddingTop: Platform.OS === 'android' ? 25 : 0 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.md },
    backBtn: { padding: Spacing.sm },
    headerTitle: { flex: 1, fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.textPrimary, textAlign: 'center' },
    markAllRead: { fontSize: FontSize.sm, color: Colors.primary, paddingHorizontal: Spacing.sm },
    headerRight: { width: 60 },

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
});
