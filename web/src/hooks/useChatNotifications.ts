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
  const isChatOpenRef = useRef(isChatOpen);
  const activeChannelIdRef = useRef(activeChannelId);
  const onSelectChannelRef = useRef(onSelectChannel);
  isChatOpenRef.current = isChatOpen;
  activeChannelIdRef.current = activeChannelId;
  onSelectChannelRef.current = onSelectChannel;

  const checkChannelsForNewMessages = useCallback(async () => {
    try {
      const channels = await chatService.getChannels();
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
            if (isChatOpenRef.current && activeChannelIdRef.current === ch.id) {
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
                  onSelectChannelRef.current(ch.id);
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
  }, [currentUserId]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void checkChannelsForNewMessages();
    };
    const start = () => {
      if (interval) clearInterval(interval);
      interval = null;
      if (typeof document !== 'undefined' && document.hidden) return;
      interval = setInterval(tick, 15000);
    };
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        if (interval) clearInterval(interval);
        interval = null;
        return;
      }
      tick();
      start();
    };
    tick();
    start();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      if (interval) clearInterval(interval);
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
