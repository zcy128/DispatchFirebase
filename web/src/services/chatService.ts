import { apiRequest } from './api';
import { db } from './firebase';
import { collection, query, orderBy, limit, where, onSnapshot, Unsubscribe, QueryConstraint } from 'firebase/firestore';
import { auth } from './firebase';
import { ChatChannel, ChatMessage, ChatMember, SendMessagePayload, CreateParentChannelPayload } from '../types/chat';

async function messageListenerId(): Promise<string> {
  const user = auth?.currentUser;
  if (!user) return '';
  try {
    const result = await user.getIdTokenResult();
    const claim = result.claims.employeeId;
    if (typeof claim === 'string' && claim.trim()) return claim.trim();
  } catch {
    // The signed-in uid still satisfies the direct-message rule.
  }
  return user.uid || '';
}

export const chatService = {
  /**
   * List channels available to the current user (Fleet channels, Office group, Broadcast, Direct chats, Parent chats)
   */
  async getChannels(): Promise<ChatChannel[]> {
    return apiRequest<ChatChannel[]>('/api/chat/channels');
  },

  /**
   * Get single channel details
   */
  async getChannel(id: string): Promise<ChatChannel> {
    return apiRequest<ChatChannel>(`/api/chat/channels/${id}`);
  },

  /**
   * Create or retrieve a deterministic 1-on-1 direct message channel
   */
  async createOrGetDirectChannel(targetUserId: string): Promise<ChatChannel> {
    return apiRequest<ChatChannel>('/api/chat/channels/direct', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  },

  /**
   * Create or retrieve a parent communication channel
   */
  async createOrGetParentChannel(payload: CreateParentChannelPayload): Promise<ChatChannel> {
    return apiRequest<ChatChannel>('/api/chat/channels/parent', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * List recent messages for a channel
   */
  async getMessages(channelId: string, count: number = 50): Promise<ChatMessage[]> {
    return apiRequest<ChatMessage[]>(`/api/chat/channels/${channelId}/messages?limit=${count}`);
  },

  /**
   * Send a message to a channel
   */
  async sendMessage(channelId: string, payload: SendMessagePayload): Promise<ChatMessage> {
    return apiRequest<ChatMessage>(`/api/chat/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * List available contacts for direct messaging (drivers, dispatchers, finance/office)
   * Formatted with dynamically calculated display names
   */
  async getContacts(): Promise<ChatMember[]> {
    return apiRequest<ChatMember[]>('/api/chat/contacts');
  },

  /**
   * Get the current user's dynamically computed display name
   */
  async getMyDisplayName(): Promise<{ displayName: string; role: string }> {
    return apiRequest<{ displayName: string; role: string }>('/api/chat/display-name');
  },

  /**
   * Realtime Firestore message listener with graceful fallback
   */
  subscribeToMessages(
    channelId: string,
    callback: (messages: ChatMessage[]) => void,
    limitCount: number = 50,
    onError?: () => void
  ): Unsubscribe | null {
    if (!db) {
      return null;
    }

    const firestore = db;
    let cancelled = false;
    let unsubscribe: Unsubscribe | null = null;
    void (async () => {
      try {
        const messagesRef = collection(firestore, 'chat_channels', channelId, 'messages');
        const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc'), limit(limitCount)];
        if (channelId.startsWith('dm-')) {
          const listenerId = await messageListenerId();
          if (cancelled) return;
          if (!listenerId) {
            onError?.();
            return;
          }
          constraints.unshift(where('memberIds', 'array-contains', listenerId));
        }
        if (cancelled) return;
        const q = query(messagesRef, ...constraints);
        const stop = onSnapshot(
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
            msgs.reverse();
            callback(msgs);
          },
          (error) => {
            console.warn('[Chat] Firestore realtime listener notice:', error);
            onError?.();
          }
        );
        if (cancelled) {
          stop();
          return;
        }
        unsubscribe = stop;
      } catch (e) {
        console.warn('[Chat] Could not establish realtime listener:', e);
        if (!cancelled) onError?.();
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  },
};
