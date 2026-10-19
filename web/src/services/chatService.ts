import { apiRequest } from './api';
import { db } from './firebase';
import { collection, query, orderBy, limit, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { ChatChannel, ChatMessage, ChatMember, SendMessagePayload, CreateParentChannelPayload } from '../types/chat';

export const chatService = {
  /**
   * List channels available to the current user (Fleet channels, Office group, Broadcast, Direct chats, Parent chats)
   */
  async getChannels(userId?: string): Promise<ChatChannel[]> {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return apiRequest<ChatChannel[]>(`/chat/channels${q}`);
  },

  /**
   * Get single channel details
   */
  async getChannel(id: string): Promise<ChatChannel> {
    return apiRequest<ChatChannel>(`/chat/channels/${id}`);
  },

  /**
   * Create or retrieve a deterministic 1-on-1 direct message channel
   */
  async createOrGetDirectChannel(targetUserId: string): Promise<ChatChannel> {
    return apiRequest<ChatChannel>('/chat/channels/direct', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  },

  /**
   * Create or retrieve a parent communication channel
   */
  async createOrGetParentChannel(payload: CreateParentChannelPayload): Promise<ChatChannel> {
    return apiRequest<ChatChannel>('/chat/channels/parent', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * List recent messages for a channel
   */
  async getMessages(channelId: string, count: number = 50): Promise<ChatMessage[]> {
    return apiRequest<ChatMessage[]>(`/chat/channels/${channelId}/messages?limit=${count}`);
  },

  /**
   * Send a message to a channel
   */
  async sendMessage(channelId: string, payload: SendMessagePayload): Promise<ChatMessage> {
    return apiRequest<ChatMessage>(`/chat/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * List available contacts for direct messaging (drivers, dispatchers, finance/office)
   * Formatted with dynamically calculated display names
   */
  async getContacts(): Promise<ChatMember[]> {
    return apiRequest<ChatMember[]>('/chat/contacts');
  },

  /**
   * Get the current user's dynamically computed display name
   */
  async getMyDisplayName(): Promise<{ displayName: string; role: string }> {
    return apiRequest<{ displayName: string; role: string }>('/chat/display-name');
  },

  /**
   * Realtime Firestore message listener with graceful fallback
   */
  subscribeToMessages(
    channelId: string,
    callback: (messages: ChatMessage[]) => void,
    limitCount: number = 50
  ): Unsubscribe | null {
    if (!db) {
      return null;
    }

    try {
      const messagesRef = collection(db, 'chat_channels', channelId, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(limitCount));

      return onSnapshot(
        q,
        (snapshot) => {
          const msgs: ChatMessage[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            msgs.push({
              id: doc.id,
              channelId,
              senderId: data.senderId || '',
              senderName: data.senderName || '',
              text: data.text || '',
              mediaUrl: data.mediaUrl,
              mediaType: data.mediaType,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || ''),
            });
          });
          callback(msgs);
        },
        (error) => {
          console.warn('[Chat] Firestore realtime listener notice:', error);
        }
      );
    } catch (e) {
      console.warn('[Chat] Could not establish realtime listener:', e);
      return null;
    }
  },
};
