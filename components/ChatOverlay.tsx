import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { subscribe, getActiveSlotId, getAllSessions, closeChat, type ChatSession } from '../config/chatManager';
import ChatWindow from './ChatWindow';

const SCREEN_WIDTH = Dimensions.get('window').width;
const ANIM_DURATION = 280;
const DISMISS_THRESHOLD = SCREEN_WIDTH * 0.25;
const VELOCITY_THRESHOLD = 600;
const EDGE_ZONE_WIDTH = SCREEN_WIDTH * 0.35;

function AnimatedChatSlot({ session, isActive }: { session: ChatSession; isActive: boolean; }) {
    const translateX = useSharedValue(SCREEN_WIDTH);
    const wasActive = useSharedValue(0);
    const animatingOut = useSharedValue(0);
    const startX = useSharedValue(0);

    useEffect(() => {
        if (isActive && animatingOut.value === 0) {
            translateX.value = withTiming(0, { duration: ANIM_DURATION });
            wasActive.value = 1;
        } else if (!isActive && wasActive.value === 1 && animatingOut.value === 0) {
            wasActive.value = 0;
            translateX.value = withTiming(SCREEN_WIDTH, { duration: ANIM_DURATION });
        }
    }, [isActive]);

    const pan = Gesture.Pan()
        .activeOffsetX(20)
        .failOffsetY([-15, 15])
        .failOffsetX(-20)
        .enabled(isActive)
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
                wasActive.value = 0;
                translateX.value = withTiming(SCREEN_WIDTH, { duration: 200 }, () => {
                    animatingOut.value = 0;
                    runOnJS(closeChat)();
                });
            } else {
                translateX.value = withTiming(0, { duration: 200 });
            }
        });

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    return (
        <GestureDetector gesture={pan}>
            <Animated.View
                style={[styles.slot, animStyle]}
                pointerEvents={isActive ? 'auto' : 'none'}
            >
                <ChatWindow
                    conversationId={session.conversationId}
                    peerId={session.peerId}
                    isVisible={isActive}
                />
            </Animated.View>
        </GestureDetector>
    );
}

export default function ChatOverlay() {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

    const sync = useCallback(() => {
        setSessions(getAllSessions());
        setActiveSlotId(getActiveSlotId());
    }, []);

    useEffect(() => {
        sync();
        return subscribe(sync);
    }, [sync]);

    if (sessions.length === 0) return null;

    return (
        <View style={styles.container} pointerEvents="box-none">
            {sessions.map(s => (
                <AnimatedChatSlot
                    key={s.slotId}
                    session={s}
                    isActive={activeSlotId === s.slotId}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
    },
    slot: {
        ...StyleSheet.absoluteFillObject,
    },
});
