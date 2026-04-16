import { API_ENDPOINTS } from '@/config/api';
import { ApiError, getJson, requestJson } from '@/shared/http/client';

import type { ChatMessageItem, ConversationItem, SendChatMessageResult } from './types';

async function unwrapData<T>(request: Promise<{ code: number; msg?: string; data: T }>) {
  const response = await request;
  if (response.code !== 0) {
    throw new ApiError(response.msg || '请求失败', 200, response.code, response);
  }
  return response.data;
}

export function fetchConversations(page = 1) {
  return unwrapData<ConversationItem[]>(
    getJson(API_ENDPOINTS.CONVERSATIONS, { page })
  );
}

export function fetchChatHistory(conversationId: string | number, page = 1) {
  return unwrapData<ChatMessageItem[]>(
    getJson(API_ENDPOINTS.CHAT_HISTORY, {
      conversation_id: conversationId,
      page,
    })
  );
}

export function sendChatMessage(receiverId: number, content: string, senderId?: number) {
  return unwrapData<SendChatMessageResult>(
    requestJson(API_ENDPOINTS.SEND_MESSAGE, {
      method: 'POST',
      body: JSON.stringify({
        sender_id: senderId,
        receiver_id: receiverId,
        content,
      }),
    })
  );
}

export function toggleConversationPin(conversationId: number, userId?: number) {
  return unwrapData<{ is_pinned: boolean }>(
    requestJson(API_ENDPOINTS.TOGGLE_CONVERSATION_PIN, {
      method: 'POST',
      body: JSON.stringify({
        conversation_id: conversationId,
        user_id: userId,
      }),
    })
  );
}

export function deleteConversation(conversationId: number, userId?: number) {
  return unwrapData<Record<string, never>>(
    requestJson(API_ENDPOINTS.DELETE_CONVERSATION, {
      method: 'POST',
      body: JSON.stringify({
        conversation_id: conversationId,
        user_id: userId,
      }),
    })
  );
}
