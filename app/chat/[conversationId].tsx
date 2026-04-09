import { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { openChat } from '../../config/chatManager';

export default function ChatRedirect() {
    const { conversationId, peer_id } = useLocalSearchParams<{ conversationId: string; peer_id: string }>();
    const router = useRouter();

    useEffect(() => {
        if (conversationId && peer_id) {
            openChat(conversationId, Number(peer_id));
        }
        if (router.canGoBack()) {
            router.back();
        }
    }, []);

    return <View style={{ flex: 1 }} />;
}
