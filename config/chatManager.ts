export type ChatSession = {
    slotId: string;
    conversationId: string;
    peerId: number;
};

type Listener = () => void;

let activeSlotId: string | null = null;
let slotCounter = 0;
const sessions = new Map<string, ChatSession>();
const listeners = new Set<Listener>();

function notify() {
    listeners.forEach(fn => fn());
}

function createSlotId() {
    return `slot_${++slotCounter}`;
}

export function preloadSessions(list: { conversationId: string; peerId: number }[]) {
    let changed = false;
    for (const item of list) {
        if (!sessions.has(item.conversationId)) {
            sessions.set(item.conversationId, {
                slotId: createSlotId(),
                conversationId: item.conversationId,
                peerId: item.peerId,
            });
            changed = true;
        }
    }
    if (changed) notify();
}

export function openChat(conversationId: string, peerId: number) {
    let session = sessions.get(conversationId);
    if (!session) {
        session = { slotId: createSlotId(), conversationId, peerId };
        sessions.set(conversationId, session);
    }
    activeSlotId = session.slotId;
    notify();
}

export function closeChat() {
    activeSlotId = null;
    notify();
}

export function getActiveSlotId(): string | null {
    return activeSlotId;
}

export function getActiveConversationId(): string | null {
    if (!activeSlotId) return null;
    for (const s of sessions.values()) {
        if (s.slotId === activeSlotId) return s.conversationId;
    }
    return null;
}

export function getAllSessions(): ChatSession[] {
    return Array.from(sessions.values());
}

export function replaceSession(oldId: string, newId: string) {
    const entry = sessions.get(oldId);
    if (!entry) return;
    sessions.delete(oldId);

    if (sessions.has(newId)) {
        if (activeSlotId === entry.slotId) {
            activeSlotId = sessions.get(newId)!.slotId;
        }
        notify();
        return;
    }

    entry.conversationId = newId;
    sessions.set(newId, entry);
}

export function removeSession(conversationId: string) {
    const entry = sessions.get(conversationId);
    sessions.delete(conversationId);
    if (entry && activeSlotId === entry.slotId) activeSlotId = null;
    notify();
}

export function subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
}
