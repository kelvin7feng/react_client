import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, DeviceEventEmitter } from 'react-native';
import { API_BASE_URL } from './api';

const WS_URL = API_BASE_URL.replace(/^http/, 'ws') + '/ws';

const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;
const WS_EVENT_PREFIX = 'ws:';

type MessageHandler = (type: string, data: any) => void;

export function useWebSocket(
    userId: string | number | null | undefined,
    onMessage: MessageHandler,
) {
    const wsRef = useRef<WebSocket | null>(null);
    const retriesRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const unmountedRef = useRef(false);
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    const cleanup = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.onopen = null;
            wsRef.current.onmessage = null;
            wsRef.current.onerror = null;
            wsRef.current.onclose = null;
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    const connect = useCallback(() => {
        if (!userId || unmountedRef.current) return;
        cleanup();

        const ws = new WebSocket(`${WS_URL}?user_id=${userId}`);
        wsRef.current = ws;

        ws.onopen = () => {
            retriesRef.current = 0;
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type) {
                    onMessageRef.current(msg.type, msg.data);
                    DeviceEventEmitter.emit(WS_EVENT_PREFIX + msg.type, msg.data);
                }
            } catch {}
        };

        ws.onerror = () => {};

        ws.onclose = () => {
            if (unmountedRef.current) return;
            const delay = Math.min(
                RECONNECT_BASE_MS * Math.pow(2, retriesRef.current),
                RECONNECT_MAX_MS,
            );
            retriesRef.current += 1;
            timerRef.current = setTimeout(connect, delay);
        };
    }, [userId, cleanup]);

    useEffect(() => {
        unmountedRef.current = false;
        connect();

        const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
            if (state === 'active') {
                if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                    retriesRef.current = 0;
                    connect();
                }
            }
        });

        return () => {
            unmountedRef.current = true;
            cleanup();
            sub.remove();
        };
    }, [connect, cleanup]);
}

export function useWSEvent(type: string, handler: (data: any) => void) {
    const handlerRef = useRef(handler);
    handlerRef.current = handler;

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener(
            WS_EVENT_PREFIX + type,
            (data) => handlerRef.current(data),
        );
        return () => sub.remove();
    }, [type]);
}
