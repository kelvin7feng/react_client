import { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, FlatList, Image,
    StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { buildApiUrl, API_ENDPOINTS, API_BASE_URL } from '../../config/api';
import { Colors, Spacing, FontSize } from '../../config/styles';
import { useAuth } from '../../config/auth';

const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    try {
        const date = new Date(timeStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        if (diff < 86400000) return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return timeStr; }
};

export default function ChatScreen() {
    const { conversationId, peer_id } = useLocalSearchParams<{ conversationId: string; peer_id: string }>();
    const router = useRouter();
    const { userId } = useAuth();
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [peerInfo, setPeerInfo] = useState<any>(null);
    const listRef = useRef<FlatList>(null);

    const fetchMessages = useCallback(async () => {
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.CHAT_HISTORY, {
                conversation_id: conversationId!, user_id: userId!, page: 1,
            }));
            const result = await response.json();
            if (result.code === 0) setMessages(result.data || []);
        } catch {}
    }, [conversationId, userId]);

    const fetchPeerInfo = useCallback(async () => {
        if (!peer_id) return;
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.GET_BASIC_INFO, { id: Number(peer_id) }));
            const result = await response.json();
            if (result.code === 0) setPeerInfo(result.data);
        } catch {}
    }, [peer_id]);

    useEffect(() => {
        fetchMessages();
        fetchPeerInfo();
        const interval = setInterval(fetchMessages, 5000);
        return () => clearInterval(interval);
    }, [fetchMessages, fetchPeerInfo]);

    const handleSend = async () => {
        if (!inputText.trim() || sending) return;
        setSending(true);
        const text = inputText.trim();
        setInputText('');
        try {
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.SEND_MESSAGE}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender_id: userId!, receiver_id: Number(peer_id), content: text }),
            });
            const result = await response.json();
            if (result.code === 0) {
                fetchMessages();
            }
        } catch {} finally { setSending(false); }
    };

    const renderMessage = ({ item }: { item: any }) => {
        const isMine = item.sender_id === userId!;
        return (
            <View style={[s.msgRow, isMine && s.msgRowMine]}>
                {!isMine && <Image source={{ uri: peerInfo?.avatar || 'https://picsum.photos/80/80' }} style={s.chatAvatar} />}
                <View style={[s.bubble, isMine ? s.bubbleMine : s.bubblePeer]}>
                    <Text style={[s.bubbleText, isMine && s.bubbleTextMine]}>{item.content}</Text>
                </View>
                {isMine && <View style={s.chatAvatar} />}
            </View>
        );
    };

    return (
        <SafeAreaView style={s.container}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={s.headerTitle} numberOfLines={1}>{peerInfo?.username || '聊天'}</Text>
                <View style={s.backBtn} />
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
                <FlatList ref={listRef} data={messages} renderItem={renderMessage}
                    keyExtractor={item => String(item.id)} style={s.list}
                    contentContainerStyle={s.listContent}
                    onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })} />

                <View style={s.inputBar}>
                    <TextInput style={s.input} value={inputText} onChangeText={setInputText}
                        placeholder="输入消息..." placeholderTextColor={Colors.textTertiary}
                        returnKeyType="send" onSubmitEditing={handleSend} />
                    <TouchableOpacity style={[s.sendBtn, !inputText.trim() && s.sendBtnDisabled]}
                        onPress={handleSend} disabled={!inputText.trim() || sending}>
                        <Ionicons name="send" size={20} color={inputText.trim() ? Colors.white : Colors.textTertiary} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background, paddingTop: Platform.OS === 'android' ? 25 : 0 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.backgroundWhite, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
    backBtn: { width: 40, alignItems: 'center' },
    headerTitle: { flex: 1, fontSize: FontSize.lg, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
    list: { flex: 1 },
    listContent: { padding: Spacing.md },
    msgRow: { flexDirection: 'row', marginBottom: Spacing.md, alignItems: 'flex-end' },
    msgRowMine: { flexDirection: 'row-reverse' },
    chatAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.backgroundGray, marginHorizontal: Spacing.sm },
    bubble: { maxWidth: '70%', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, borderRadius: 16 },
    bubblePeer: { backgroundColor: Colors.backgroundWhite, borderBottomLeftRadius: 4 },
    bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
    bubbleText: { fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 22 },
    bubbleTextMine: { color: Colors.white },
    inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.backgroundWhite, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
    input: { flex: 1, backgroundColor: Colors.backgroundGray, borderRadius: 20, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.md, color: Colors.textPrimary, marginRight: Spacing.sm },
    sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
    sendBtnDisabled: { backgroundColor: Colors.backgroundGray },
});
