import { useState, useEffect, useRef, useCallback } from 'react';
import { chatService } from '../services/chatService';
import { notificationService } from '../services/notificationService';
import { ChatChannel } from '../types/chat';

export interface InAppChatAlert {
  id: string;
  senderName: string;
  channelName: string;
  text: string;
  channelId: string;
}

export function useChatNotifications(
  currentUserId: string,
  isChatOpen: boolean,
  activeChannelId: string | null,
  onSelectChannel: (channelId: string) => void
) {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [activeAlert, setActiveAlert] = useState<InAppChatAlert | null>(null);
  const lastSeenMapRef = useRef<Record<string, string>>({});
  const isInitialSyncRef = useRef<boolean>(true);
  const alertTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkChannelsForNewMessages = useCallback(async () => {
    try {
      const channels = await chatService.getChannels(currentUserId);
      if (!channels || channels.length === 0) return;

      if (isInitialSyncRef.current) {
        // Record baseline timestamps so we don't alert on historical messages
        channels.forEach((ch: ChatChannel) => {
          if (ch.lastMessage?.createdAt) {
            lastSeenMapRef.current[ch.id] = ch.lastMessage.createdAt;
          }
        });
        isInitialSyncRef.current = false;
        return;
      }

      channels.forEach((ch: ChatChannel) => {
        const lastMsg = ch.lastMessage;
        if (!lastMsg || !lastMsg.createdAt || !lastMsg.text) return;

        const prevTime = lastSeenMapRef.current[ch.id];
        const isNewer = !prevTime || new Date(lastMsg.createdAt).getTime() > new Date(prevTime).getTime();

        if (isNewer) {
          lastSeenMapRef.current[ch.id] = lastMsg.createdAt;

          // Check if sender was someone else
          const isFromMe =
            lastMsg.senderId === currentUserId ||
            lastMsg.senderName === 'You' ||
            (currentUserId && lastMsg.senderId.includes(currentUserId));

          if (!isFromMe) {
            // If user is currently looking at this exact chat in the open drawer, don't alert
            if (isChatOpen && activeChannelId === ch.id) {
              return;
            }

            setUnreadCount((c) => c + 1);
            notificationService.playChime();

            // 1. Show Native Desktop Notification (Windows/Mac notification banner)
            notificationService.showDesktopNotification(
              `💬 ${lastMsg.senderName || 'Driver'} (${ch.name})`,
              {
                body: lastMsg.text,
                tag: `chat-${ch.id}`,
                onClick: () => {
                  onSelectChannel(ch.id);
                },
              }
            );

            // 2. Show In-App Floating Toast Alert
            setActiveAlert({
              id: `alert-${Date.now()}`,
              senderName: lastMsg.senderName || 'New Message',
              channelName: ch.name,
              text: lastMsg.text,
              channelId: ch.id,
            });

            if (alertTimeoutRef.current) {
              clearTimeout(alertTimeoutRef.current);
            }
            alertTimeoutRef.current = setTimeout(() => {
              setActiveAlert(null);
            }, 6000);
          }
        }
      });
    } catch {
      // Ignore background check failure
    }
  }, [currentUserId, isChatOpen, activeChannelId, onSelectChannel]);

  useEffect(() => {
    // Initial sync
    checkChannelsForNewMessages();

    // Check periodically every 3.5 seconds
    const interval = setInterval(checkChannelsForNewMessages, 3500);

    return () => {
      clearInterval(interval);
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    };
  }, [checkChannelsForNewMessages]);

  const clearUnread = useCallback(() => {
    setUnreadCount(0);
    setActiveAlert(null);
  }, []);

  const dismissAlert = useCallback(() => {
    setActiveAlert(null);
  }, []);

  return {
    unreadCount,
    activeAlert,
    clearUnread,
    dismissAlert,
  };
}
