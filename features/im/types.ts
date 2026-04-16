export type ConversationItem = {
  id: number;
  user1_id: number;
  user2_id: number;
  last_message?: string;
  last_message_time?: string;
  user1_name?: string;
  user1_avatar?: string;
  user2_name?: string;
  user2_avatar?: string;
  unread_count: number;
  pinned_by?: string;
  is_pinned: boolean;
};

export type ChatMessageItem = {
  id: number | string;
  conversation_id?: number;
  sender_id: number;
  content: string;
  is_read?: boolean;
  created_time?: string;
  _optimistic?: boolean;
  receiver_id?: number;
};

export type SendChatMessageResult = {
  message_id: number;
  conversation_id: number;
};
