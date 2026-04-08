import { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, FlatList,
    StyleSheet, KeyboardAvoidingView, Platform, Keyboard, ScrollView, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { buildApiUrl, API_ENDPOINTS, API_BASE_URL } from '../../config/api';
import { Colors, Spacing, FontSize } from '../../config/styles';
import { useAuth } from '../../config/auth';
import { navigateToUserProfile } from '../../config/utils';
import { RemoteImage } from '../../components/RemoteImage';
import { useWSEvent } from '../../config/useWebSocket';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const EMOJI_SIZE = 32;
const EMOJI_COLUMNS = 8;
const EMOJI_PANEL_HEIGHT = 260;
const ACTION_PANEL_HEIGHT = 120;

const EMOJI_LIST = [
    '😀','😃','😄','😁','😆','😅','🤣','😂',
    '🙂','🙃','😉','😊','😇','🥰','😍','🤩',
    '😘','😗','😚','😙','🥲','😋','😛','😜',
    '🤪','😝','🤑','🤗','🤭','🤫','🤔','🫣',
    '😐','😑','😶','🫥','😏','😒','🙄','😬',
    '😮‍💨','🤥','😌','😔','😪','🤤','😴','😷',
    '🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵',
    '🤯','🤠','🥳','🥸','😎','🤓','🧐','😕',
    '🫤','😟','🙁','😮','😯','😲','😳','🥺',
    '🥹','😦','😧','😨','😰','😥','😢','😭',
    '😱','😖','😣','😞','😓','😩','😫','🥱',
    '👍','👎','👏','🙌','🤝','❤️','🔥','💯',
    '✨','🎉','🎊','💪','🙏','😺','😸','😻',
    '👋','✌️','🤞','🤟','🤘','👌','🤏','👈',
    '👉','👆','👇','☝️','✋','🤚','🖐️','🖖',
];

type PanelType = 'none' | 'emoji' | 'action';

const ChatBubble = memo(({ item, isMine, myAvatar, peerAvatar, onPeerPress }: {
    item: any; isMine: boolean; myAvatar: string; peerAvatar: string; onPeerPress: () => void;
}) => (
    <View style={[s.msgRow, isMine && s.msgRowMine]}>
        {isMine ? (
            <RemoteImage uri={myAvatar || 'https://picsum.photos/80/80'} style={s.chatAvatar} contentFit="cover" />
        ) : (
            <TouchableOpacity onPress={onPeerPress} activeOpacity={0.7}>
                <RemoteImage uri={peerAvatar || 'https://picsum.photos/80/80'} style={s.chatAvatar} contentFit="cover" />
            </TouchableOpacity>
        )}
        <View style={[s.bubble, isMine ? s.bubbleMine : s.bubblePeer]}>
            <Text style={[s.bubbleText, isMine && s.bubbleTextMine]}>{item.content}</Text>
        </View>
    </View>
));

const PLUS_ACTIONS = [
    { key: 'album', icon: 'images-outline' as const, label: '相册' },
    { key: 'camera', icon: 'camera-outline' as const, label: '拍照' },
    { key: 'location', icon: 'location-outline' as const, label: '位置' },
    { key: 'share', icon: 'document-text-outline' as const, label: '分享笔记' },
];

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

let optimisticIdCounter = 0;

export default function ChatScreen() {
    const { conversationId: rawConvId, peer_id } = useLocalSearchParams<{ conversationId: string; peer_id: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { userId } = useAuth();
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [peerInfo, setPeerInfo] = useState<any>(null);
    const [myAvatar, setMyAvatar] = useState<string>('');
    const [activePanel, setActivePanel] = useState<PanelType>('none');
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [ready, setReady] = useState(false);
    const listRef = useRef<FlatList>(null);
    const inputRef = useRef<TextInput>(null);
    const msgSnapshotRef = useRef<string>('');
    const [realConvId, setRealConvId] = useState<string | null>(rawConvId === 'new' ? null : rawConvId!);

    const isNewChat = rawConvId === 'new';

    const scrollToBottom = useCallback((animated = false) => {
        setTimeout(() => {
            listRef.current?.scrollToEnd({ animated });
        }, 50);
    }, []);

    const fetchMessages = useCallback(async (isInitial = false) => {
        if (!realConvId) return;
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.CHAT_HISTORY, {
                conversation_id: realConvId, user_id: userId!, page: 1,
            }));
            const result = await response.json();
            if (result.code === 0) {
                const newData: any[] = result.data || [];
                const snapshot = newData.map(m => m.id).join(',');
                if (snapshot !== msgSnapshotRef.current) {
                    const hadMessages = msgSnapshotRef.current !== '';
                    msgSnapshotRef.current = snapshot;
                    setMessages(newData);
                    if (hadMessages) {
                        scrollToBottom(true);
                    }
                }
                if (isInitial) setReady(true);
            }
        } catch {
            if (isInitial) setReady(true);
        }
    }, [realConvId, userId, scrollToBottom]);

    const fetchPeerInfo = useCallback(async () => {
        if (!peer_id) return;
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.GET_BASIC_INFO, { id: Number(peer_id) }));
            const result = await response.json();
            if (result.code === 0) setPeerInfo(result.data);
        } catch {}
    }, [peer_id]);

    const fetchMyAvatar = useCallback(async () => {
        if (!userId) return;
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.GET_BASIC_INFO, { id: userId }));
            const result = await response.json();
            if (result.code === 0) setMyAvatar(result.data?.avatar || '');
        } catch {}
    }, [userId]);

    const resolveConversationId = useCallback(async () => {
        if (!userId || !peer_id) return;
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATIONS, { user_id: userId, page: 1 }));
            const result = await response.json();
            if (result.code === 0) {
                const peerId = Number(peer_id);
                const conv = (result.data || []).find((c: any) =>
                    (c.user1_id === userId && c.user2_id === peerId) ||
                    (c.user2_id === userId && c.user1_id === peerId)
                );
                if (conv) setRealConvId(String(conv.id));
            }
        } catch {}
    }, [userId, peer_id]);

    useEffect(() => {
        fetchPeerInfo();
        fetchMyAvatar();
        if (isNewChat) {
            resolveConversationId();
            setReady(true);
        }
    }, [fetchPeerInfo, fetchMyAvatar, isNewChat, resolveConversationId]);

    const initialScrollDone = useRef(false);

    useEffect(() => {
        if (!realConvId) return;
        fetchMessages(true);
        const interval = setInterval(() => fetchMessages(false), 30000);
        return () => clearInterval(interval);
    }, [realConvId]);

    useEffect(() => {
        if (ready && messages.length > 0 && !initialScrollDone.current) {
            initialScrollDone.current = true;
            setTimeout(() => {
                listRef.current?.scrollToEnd({ animated: false });
            }, 100);
        }
    }, [ready, messages]);

    useWSEvent('new_message', useCallback((data: any) => {
        if (!realConvId) return;
        if (String(data?.conversation_id) === realConvId) {
            fetchMessages(false);
        }
    }, [realConvId, fetchMessages]));

    useEffect(() => {
        const showSub = Keyboard.addListener('keyboardWillShow', () => {
            setKeyboardVisible(true);
            if (activePanel !== 'none') setActivePanel('none');
            scrollToBottom(true);
        });
        const hideSub = Keyboard.addListener('keyboardWillHide', () => {
            setKeyboardVisible(false);
        });
        return () => { showSub.remove(); hideSub.remove(); };
    }, [activePanel, scrollToBottom]);

    const handleSend = async () => {
        if (!inputText.trim() || sending) return;
        setSending(true);
        const text = inputText.trim();
        setInputText('');

        const optimisticMsg = {
            id: `_opt_${++optimisticIdCounter}`,
            sender_id: userId!,
            receiver_id: Number(peer_id),
            content: text,
            created_at: new Date().toISOString(),
            _optimistic: true,
        };
        setMessages(prev => [...prev, optimisticMsg]);
        scrollToBottom(true);

        try {
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.SEND_MESSAGE}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender_id: userId!, receiver_id: Number(peer_id), content: text }),
            });
            const result = await response.json();
            if (result.code === 0) {
                if (!realConvId) {
                    await resolveConversationId();
                }
                fetchMessages(false);
            }
        } catch {} finally { setSending(false); }
    };

    const togglePanel = (panel: PanelType) => {
        if (activePanel === panel) {
            setActivePanel('none');
            inputRef.current?.focus();
        } else {
            Keyboard.dismiss();
            setTimeout(() => {
                setActivePanel(panel);
                scrollToBottom(true);
            }, 80);
        }
    };

    const handleEmojiSelect = (emoji: string) => {
        setInputText(prev => prev + emoji);
    };

    const handleActionPress = (key: string) => {
        setActivePanel('none');
        // TODO: 后续接入具体功能
    };

    const handlePeerPress = useCallback(() => {
        if (peer_id) navigateToUserProfile(router, Number(peer_id), userId ?? null);
    }, [peer_id, userId]);

    const peerAvatar = peerInfo?.avatar || '';

    const renderMessage = useCallback(({ item }: { item: any }) => (
        <ChatBubble
            item={item}
            isMine={item.sender_id === userId!}
            myAvatar={myAvatar}
            peerAvatar={peerAvatar}
            onPeerPress={handlePeerPress}
        />
    ), [userId, myAvatar, peerAvatar, handlePeerPress]);

    const panelHeight = activePanel === 'emoji' ? EMOJI_PANEL_HEIGHT : activePanel === 'action' ? ACTION_PANEL_HEIGHT : 0;

    return (
        <View style={s.container}>
            <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => peer_id && navigateToUserProfile(router, Number(peer_id), userId ?? null)}
                    activeOpacity={0.7}
                >
                    <Text style={s.headerTitle} numberOfLines={1}>{peerInfo?.username || '聊天'}</Text>
                </TouchableOpacity>
                <View style={s.backBtn} />
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
                {ready && (
                <FlatList
                    ref={listRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={item => String(item.id)}
                    style={s.list}
                    contentContainerStyle={s.listContent}
                    onTouchStart={() => {
                        if (activePanel !== 'none') setActivePanel('none');
                        Keyboard.dismiss();
                    }}
                />
                )}

                <View style={[s.inputBar, { paddingBottom: activePanel !== 'none' ? 5 : keyboardVisible ? 5 : insets.bottom + 5 }]}>
                    <TextInput
                        ref={inputRef}
                        style={s.input}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="输入消息..."
                        placeholderTextColor={Colors.textTertiary}
                        returnKeyType="send"
                        blurOnSubmit={false}
                        onSubmitEditing={handleSend}
                        onFocus={() => { if (activePanel !== 'none') setActivePanel('none'); }}
                        multiline={false}
                        maxLength={500}
                    />

                    <View style={s.rightTools}>
                        <TouchableOpacity
                            style={s.toolBtn}
                            onPress={() => togglePanel('emoji')}
                            activeOpacity={0.6}
                        >
                            <Ionicons
                                name={activePanel === 'emoji' ? 'keypad-outline' : 'happy-outline'}
                                size={26}
                                color={activePanel === 'emoji' ? Colors.primary : Colors.textSecondary}
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={s.toolBtn}
                            onPress={() => togglePanel('action')}
                            activeOpacity={0.6}
                        >
                            <Ionicons
                                name="add-circle-outline"
                                size={26}
                                color={activePanel === 'action' ? Colors.primary : Colors.textSecondary}
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {activePanel !== 'none' && (
                    <View style={[s.panelContainer, { height: panelHeight + insets.bottom }]}>
                        {activePanel === 'emoji' && (
                            <ScrollView
                                style={s.emojiScroll}
                                contentContainerStyle={s.emojiGrid}
                                showsVerticalScrollIndicator={false}
                            >
                                {EMOJI_LIST.map((emoji, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        style={s.emojiItem}
                                        onPress={() => handleEmojiSelect(emoji)}
                                        activeOpacity={0.5}
                                    >
                                        <Text style={s.emojiText}>{emoji}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}

                        {activePanel === 'action' && (
                            <View style={s.actionGrid}>
                                {PLUS_ACTIONS.map(action => (
                                    <TouchableOpacity
                                        key={action.key}
                                        style={s.actionItem}
                                        onPress={() => handleActionPress(action.key)}
                                        activeOpacity={0.6}
                                    >
                                        <View style={s.actionIconWrap}>
                                            <Ionicons name={action.icon} size={24} color={Colors.textSecondary} />
                                        </View>
                                        <Text style={s.actionLabel}>{action.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                )}

            </KeyboardAvoidingView>
        </View>
    );
}

const emojiItemWidth = (SCREEN_WIDTH - Spacing.md * 2) / EMOJI_COLUMNS;

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, backgroundColor: Colors.backgroundWhite, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
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

    inputBar: {
        flexDirection: 'row', alignItems: 'flex-end',
        paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
        backgroundColor: Colors.backgroundWhite,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    },
    rightTools: {
        flexDirection: 'row', alignItems: 'flex-end',
    },
    toolBtn: {
        width: 40, height: 40,
        justifyContent: 'center', alignItems: 'center',
    },
    input: {
        flex: 1, backgroundColor: Colors.backgroundGray, borderRadius: 20,
        paddingHorizontal: Spacing.md, paddingTop: Platform.OS === 'ios' ? 10 : 8,
        paddingBottom: Platform.OS === 'ios' ? 10 : 8,
        fontSize: FontSize.md, color: Colors.textPrimary,
        maxHeight: 100, lineHeight: 20,
    },
    panelContainer: {
        backgroundColor: Colors.backgroundWhite,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    },
    emojiScroll: {
        flex: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm,
    },
    emojiGrid: {
        flexDirection: 'row', flexWrap: 'wrap',
    },
    emojiItem: {
        width: emojiItemWidth, height: emojiItemWidth,
        justifyContent: 'center', alignItems: 'center',
    },
    emojiText: { fontSize: EMOJI_SIZE - 4 },

    actionGrid: {
        flexDirection: 'row', paddingHorizontal: Spacing.md,
        paddingTop: Spacing.lg,
    },
    actionItem: {
        flex: 1, alignItems: 'center',
    },
    actionIconWrap: {
        width: 56, height: 56, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center',
    },
    actionLabel: {
        marginTop: Spacing.xs, fontSize: FontSize.xs,
        color: Colors.textSecondary, textAlign: 'center',
    },
});
