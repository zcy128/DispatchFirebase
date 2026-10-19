import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Users,
  Building,
  Radio,
  UserPlus,
  Search,
  Loader2,
  RefreshCw,
  Shield,
  Briefcase,
  Bell,
  GraduationCap,
  Phone,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import { chatService } from '../../services/chatService';
import { notificationService } from '../../services/notificationService';
import { ChatChannel, ChatMessage, ChatMember, CreateParentChannelPayload } from '../../types/chat';
import { useAuth } from '../../contexts/AuthContext';

const PARENT_QUICK_REPLIES = [
  {
    label: 'Bus On Schedule (5m)',
    text: 'Bus is currently operating on schedule. Estimated arrival time is in approximately 5 minutes.',
  },
  {
    label: 'Absence Recorded',
    text: "Student absence has been officially recorded for today's run. Thank you for notifying dispatch.",
  },
  {
    label: 'Driver Notified (Lost Item)',
    text: 'The bus driver has been notified to inspect the passenger seats for the item once safely parked.',
  },
  {
    label: 'Traffic Delay (~10m)',
    text: 'Encountering moderate traffic congestion on the route; expect an approximate 10-minute delay. Live GPS tracking is active.',
  },
];

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialTargetUserId?: string | null;
  onClearInitialTarget?: () => void;
  initialParentMetadata?: CreateParentChannelPayload | null;
  onClearInitialParentMetadata?: () => void;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  onClose,
  initialTargetUserId,
  onClearInitialTarget,
  initialParentMetadata,
  onClearInitialParentMetadata,
}) => {
  const { currentUser } = useAuth();
  const currentUserId = currentUser?.employeeId || currentUser?.uid || 'EMP-ADMIN-001';

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'staff' | 'parents'>('all');

  // Contact Picker modal state
  const [isContactPickerOpen, setIsContactPickerOpen] = useState(false);
  const [contacts, setContacts] = useState<ChatMember[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    notificationService.getPermission()
  );

  const handleRequestNotification = async () => {
    const res = await notificationService.requestPermission();
    setNotificationPermission(res);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<any>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load channels
  const loadChannels = async (selectChannelId?: string) => {
    try {
      setLoadingChannels(true);
      const list = await chatService.getChannels(currentUserId);
      setChannels(list || []);
      if (selectChannelId) {
        const found = list.find((c) => c.id === selectChannelId);
        if (found) setSelectedChannel(found);
      } else if (!selectedChannel && list.length > 0) {
        setSelectedChannel(list[0]);
      }
    } catch (err) {
      console.error('Failed to load chat channels:', err);
    } finally {
      setLoadingChannels(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadChannels();
      const channelTimer = setInterval(() => {
        chatService.getChannels(currentUserId).then((list) => {
          if (list) setChannels(list);
        }).catch(() => {});
      }, 4000);
      return () => clearInterval(channelTimer);
    }
  }, [isOpen, currentUserId]);

  // Handle direct target open (e.g. from shift card "Message Driver")
  useEffect(() => {
    if (isOpen && initialTargetUserId) {
      const startDM = async () => {
        try {
          const directChannel = await chatService.createOrGetDirectChannel(initialTargetUserId);
          await loadChannels(directChannel.id);
          setSelectedChannel(directChannel);
          setCategoryFilter('staff');
        } catch (err) {
          console.error('Failed to initiate DM:', err);
        } finally {
          if (onClearInitialTarget) onClearInitialTarget();
        }
      };
      startDM();
    }
  }, [isOpen, initialTargetUserId]);

  // Handle parent conversation open (e.g. from student roster "Message Parent")
  useEffect(() => {
    if (isOpen && initialParentMetadata) {
      const startParentChat = async () => {
        try {
          const parentCh = await chatService.createOrGetParentChannel(initialParentMetadata);
          await loadChannels(parentCh.id);
          setSelectedChannel(parentCh);
          setCategoryFilter('parents');
        } catch (err) {
          console.error('Failed to initiate parent chat:', err);
        } finally {
          if (onClearInitialParentMetadata) onClearInitialParentMetadata();
        }
      };
      startParentChat();
    }
  }, [isOpen, initialParentMetadata]);

const dedupeMessages = (list: ChatMessage[]): ChatMessage[] => {
  const map = new Map<string, ChatMessage>();
  for (const m of list) {
    if (m && m.id) {
      map.set(m.id, m);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
};

  // Subscribe to messages or poll
  useEffect(() => {
    if (!isOpen || !selectedChannel) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);

    // Initial fetch
    chatService.getMessages(selectedChannel.id)
      .then((msgs) => setMessages(dedupeMessages(msgs || [])))
      .catch((e) => console.error('Failed to load messages:', e))
      .finally(() => setLoadingMessages(false));

    // Realtime Firestore subscription
    const unsubscribe = chatService.subscribeToMessages(selectedChannel.id, (realtimeMsgs) => {
      if (realtimeMsgs) {
        setMessages(dedupeMessages(realtimeMsgs));
      }
    });

    // Guaranteed background sync every 2.5 seconds (never requires manual refresh)
    pollIntervalRef.current = setInterval(async () => {
      try {
        const fresh = await chatService.getMessages(selectedChannel.id);
        if (fresh && fresh.length > 0) {
          setMessages(dedupeMessages(fresh));
        }
      } catch {
        // ignore background poll error
      }
    }, 2500);

    return () => {
      if (unsubscribe) unsubscribe();
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen, selectedChannel?.id]);

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedChannel || sendingMessage) return;

    const textToSend = inputText.trim();
    setInputText('');
    setSendingMessage(true);

    try {
      const newMsg = await chatService.sendMessage(selectedChannel.id, { text: textToSend });
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) {
          return prev;
        }
        return [...prev, newMsg];
      });
      // Update channel last message preview
      setChannels((prev) =>
        prev.map((c) =>
          c.id === selectedChannel.id
            ? {
                ...c,
                lastMessage: {
                  text: textToSend,
                  senderId: newMsg.senderId,
                  senderName: newMsg.senderName,
                  createdAt: newMsg.createdAt,
                },
              }
            : c
        )
      );
    } catch (err) {
      console.error('Failed to send message:', err);
      // restore text on failure
      setInputText(textToSend);
    } finally {
      setSendingMessage(false);
    }
  };

  // Open Contact Picker
  const handleOpenContactPicker = async () => {
    setIsContactPickerOpen(true);
    setLoadingContacts(true);
    try {
      const list = await chatService.getContacts();
      setContacts(list || []);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleSelectContact = async (contact: ChatMember) => {
    try {
      const ch = await chatService.createOrGetDirectChannel(contact.id);
      setIsContactPickerOpen(false);
      await loadChannels(ch.id);
      setSelectedChannel(ch);
    } catch (err) {
      console.error('Failed to open direct chat:', err);
    }
  };

  const checkIsMe = (m: ChatMessage): boolean => {
    if (!m) return false;
    if (m.senderName === 'You' || m.id.startsWith('temp-')) return true;

    const myIds = [
      currentUserId,
      currentUser?.employeeId,
      currentUser?.uid,
      currentUser?.email,
      'EMP-ADMIN-001',
      'EMP-ADMIN',
    ].filter(Boolean) as string[];

    // In 1-on-1 direct channels (e.g. dm-EMP-021-EMP-ADMIN-001)
    if (selectedChannel?.type === 'direct' && selectedChannel.memberIds && selectedChannel.memberIds.length === 2) {
      const otherId = selectedChannel.memberIds.find(
        (id) => !myIds.some((my) => my.toLowerCase() === id.toLowerCase())
      );
      if (otherId && m.senderId && m.senderId.toLowerCase() === otherId.toLowerCase()) {
        return false;
      }
      if (otherId && m.senderId && m.senderId.toLowerCase() !== otherId.toLowerCase()) {
        return true;
      }
    }

    // In parent channels, the student parent is the external party
    if (selectedChannel?.type === 'parent') {
      if (
        m.senderId === selectedChannel.id ||
        m.senderId === selectedChannel.parentContact ||
        m.senderName === selectedChannel.parentName
      ) {
        return false;
      }
      return true;
    }

    const cleanSender = (m.senderId || '').replace(/^EMP-?/i, '').toLowerCase();
    for (const myId of myIds) {
      if (m.senderId && m.senderId.toLowerCase() === myId.toLowerCase()) return true;
      const cleanMy = myId.replace(/^EMP-?/i, '').toLowerCase();
      if (cleanMy && cleanMy === cleanSender) return true;
    }

    return false;
  };

  if (!isOpen) return null;

  const filteredContacts = contacts.filter((c) => {
    const q = contactSearch.toLowerCase();
    return (
      c.displayName.toLowerCase().includes(q) ||
      c.fullName.toLowerCase().includes(q) ||
      c.jobPosition.toLowerCase().includes(q) ||
      (c.empNumber && c.empNumber.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm flex justify-end transition-opacity">
      <div className="w-full max-w-4xl bg-slate-900 border-l border-slate-800 text-slate-100 flex flex-col md:flex-row h-full shadow-2xl animate-in slide-in-from-right duration-200">
        
        {/* LEFT / SIDEBAR: Channel List */}
        <div className="w-full md:w-80 border-r border-slate-800 flex flex-col h-full bg-slate-950/50">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-sm text-slate-100">Operations Chat</h2>
                <p className="text-[11px] text-slate-400">Dispatch & Fleet Messenger</p>
              </div>
            </div>
            <button
              onClick={() => handleOpenContactPicker()}
              className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 transition flex items-center space-x-1 text-xs"
              title="New Direct Message"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New DM</span>
            </button>
          </div>

          {/* Notification Permission Banner */}
          {notificationPermission === 'default' && (
            <div className="mx-3 my-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 text-amber-300">
                <Bell className="w-4 h-4 flex-shrink-0" />
                <span className="text-[11px] leading-tight">Enable desktop push alerts for incoming messages</span>
              </div>
              <button
                onClick={handleRequestNotification}
                className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[10px] uppercase tracking-wide flex-shrink-0 transition"
              >
                Enable
              </button>
            </div>
          )}

          {/* Category Tabs: All, Staff & Fleets, Parent Inquiries */}
          <div className="p-2 border-b border-slate-800 bg-slate-950/70 flex items-center space-x-1 text-xs">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`flex-1 py-1.5 px-1.5 rounded-lg font-medium transition text-center ${
                categoryFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              All ({channels.length})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('staff')}
              className={`flex-1 py-1.5 px-1.5 rounded-lg font-medium transition text-center ${
                categoryFilter === 'staff'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Staff ({channels.filter((c) => c.type !== 'parent').length})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('parents')}
              className={`flex-1 py-1.5 px-1.5 rounded-lg font-medium transition text-center flex items-center justify-center space-x-1 ${
                categoryFilter === 'parents'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span>Parents</span>
              {channels.filter((c) => c.type === 'parent').length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    categoryFilter === 'parents'
                      ? 'bg-slate-950 text-amber-400'
                      : 'bg-indigo-500/20 text-indigo-300'
                  }`}
                >
                  {channels.filter((c) => c.type === 'parent').length}
                </span>
              )}
            </button>
          </div>

          {/* Channel list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {loadingChannels && channels.length === 0 ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center space-y-2">
                <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                <span className="text-xs">Loading channels...</span>
              </div>
            ) : (
              <>
                {/* Parent Inquiries Section */}
                {(categoryFilter === 'all' || categoryFilter === 'parents') && (
                  <div className="p-2 space-y-1">
                    <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-indigo-400 uppercase flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span>Parent Inquiries</span>
                      </div>
                      <span className="text-[10px] font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded text-indigo-300 border border-indigo-500/20">
                        {channels.filter((c) => c.type === 'parent').length}
                      </span>
                    </div>

                    {channels.filter((c) => c.type === 'parent').length === 0 ? (
                      <div className="px-3 py-3 text-center text-[11px] text-slate-500">
                        No parent inquiries logged yet.
                      </div>
                    ) : (
                      channels
                        .filter((c) => c.type === 'parent')
                        .map((ch) => {
                          const isSelected = selectedChannel?.id === ch.id;
                          return (
                            <button
                              key={ch.id}
                              onClick={() => setSelectedChannel(ch)}
                              className={`w-full text-left px-3 py-2.5 rounded-lg transition flex items-start space-x-2.5 ${
                                isSelected
                                  ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30'
                                  : 'text-slate-300 hover:bg-slate-800/60'
                              }`}
                            >
                              <div className="w-6 h-6 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                                <GraduationCap className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-xs text-white truncate">{ch.name}</span>
                                </div>
                                {ch.studentName && (
                                  <div className="text-[10px] text-amber-300/90 font-medium truncate mt-0.5">
                                    {ch.studentName} {ch.busUnitNumber ? `• Bus #${ch.busUnitNumber}` : ''}
                                  </div>
                                )}
                                {ch.lastMessage && (
                                  <p className="text-[11px] text-slate-400 truncate mt-1">
                                    <span className="font-semibold text-slate-300">{ch.lastMessage.senderName}: </span>
                                    {ch.lastMessage.text}
                                  </p>
                                )}
                              </div>
                            </button>
                          );
                        })
                    )}
                  </div>
                )}

                {/* Broadcast / Office / Fleets */}
                {(categoryFilter === 'all' || categoryFilter === 'staff') && (
                  <div className="p-2 space-y-1">
                    <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                      Channels & Fleets
                    </div>
                    {channels
                      .filter((c) => c.type !== 'direct' && c.type !== 'parent')
                      .map((ch) => {
                        const isSelected = selectedChannel?.id === ch.id;
                        let Icon = Building;
                        if (ch.type === 'broadcast') Icon = Radio;
                        else if (ch.type === 'fleet') Icon = Users;

                        return (
                          <button
                            key={ch.id}
                            onClick={() => setSelectedChannel(ch)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg transition flex items-start space-x-2.5 ${
                              isSelected
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'text-slate-300 hover:bg-slate-800/60'
                            }`}
                          >
                            <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-xs truncate">{ch.name}</span>
                              </div>
                              {ch.lastMessage && (
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                  <span className="font-semibold text-slate-300">{ch.lastMessage.senderName}: </span>
                                  {ch.lastMessage.text}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}

                {/* Direct Messages */}
                {(categoryFilter === 'all' || categoryFilter === 'staff') && (
                  <div className="p-2 space-y-1">
                    <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase flex items-center justify-between">
                      <span>Direct Messages</span>
                    </div>
                    {channels.filter((c) => c.type === 'direct').length === 0 ? (
                      <div className="px-3 py-4 text-center text-[11px] text-slate-500">
                        No direct messages yet. Click 'New DM' to message a driver or staff.
                      </div>
                    ) : (
                      channels
                        .filter((c) => c.type === 'direct')
                        .map((ch) => {
                          const isSelected = selectedChannel?.id === ch.id;
                          return (
                            <button
                              key={ch.id}
                              onClick={() => setSelectedChannel(ch)}
                              className={`w-full text-left px-3 py-2.5 rounded-lg transition flex items-start space-x-2.5 ${
                                isSelected
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'text-slate-300 hover:bg-slate-800/60'
                              }`}
                            >
                              <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-amber-400 flex-shrink-0 mt-0.5">
                                {ch.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-xs truncate">{ch.name}</span>
                                </div>
                                {ch.lastMessage && (
                                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                    {ch.lastMessage.text}
                                  </p>
                                )}
                              </div>
                            </button>
                          );
                        })
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT / MAIN: Conversation & Messages */}
        <div className="flex-1 flex flex-col h-full bg-slate-900">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            {selectedChannel ? (
              selectedChannel.type === 'parent' ? (
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-sm text-white truncate">{selectedChannel.name}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-semibold uppercase flex-shrink-0">
                        Student Parent
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-300 mt-0.5 truncate">
                      {selectedChannel.studentName && (
                        <span>
                          Student: <span className="text-amber-400 font-semibold">{selectedChannel.studentName}</span>
                        </span>
                      )}
                      {selectedChannel.busUnitNumber && (
                        <span className="text-slate-400 font-mono">
                          • Bus #{selectedChannel.busUnitNumber}
                        </span>
                      )}
                      {selectedChannel.routeNo && (
                        <span className="text-slate-400 font-mono">
                          • Route {selectedChannel.routeNo}
                        </span>
                      )}
                      {selectedChannel.grade && (
                        <span className="text-slate-400">
                          • {selectedChannel.grade}
                        </span>
                      )}
                      {selectedChannel.schoolName && (
                        <span className="text-slate-400 truncate max-w-[150px]">
                          • {selectedChannel.schoolName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400">
                    {selectedChannel.type === 'broadcast' && <Radio className="w-4 h-4" />}
                    {selectedChannel.type === 'office' && <Shield className="w-4 h-4" />}
                    {selectedChannel.type === 'fleet' && <Users className="w-4 h-4" />}
                    {selectedChannel.type === 'direct' && <Briefcase className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-slate-100 flex items-center space-x-2">
                      <span>{selectedChannel.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 uppercase">
                        {selectedChannel.type}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {selectedChannel.description || 'Active conversation'}
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div className="text-sm text-slate-400">Select a conversation</div>
            )}

            <div className="flex items-center space-x-2 flex-shrink-0">
              {selectedChannel?.type === 'parent' && selectedChannel.parentContact && (
                <>
                  <a
                    href={`tel:${selectedChannel.parentContact}`}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition text-xs font-semibold flex items-center space-x-1"
                    title="Direct Phone Call"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Call</span>
                  </a>
                  <a
                    href={`sms:${selectedChannel.parentContact}`}
                    className="px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 transition text-xs font-semibold flex items-center space-x-1"
                    title="Send SMS"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">SMS</span>
                  </a>
                </>
              )}
              <button
                onClick={() => selectedChannel && chatService.getMessages(selectedChannel.id).then(setMessages)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
                title="Refresh messages"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                title="Close chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-slate-900 to-slate-950">
            {loadingMessages && messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                <span>Loading messages...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-6">
                <MessageSquare className="w-8 h-8 mb-2 text-slate-600" />
                <p className="text-xs font-medium">No messages yet in this channel.</p>
                <p className="text-[11px] text-slate-600 mt-1">Start the conversation below.</p>
              </div>
            ) : (
              dedupeMessages(messages).map((m) => {
                const isMe = checkIsMe(m);
                const timeStr = m.createdAt
                  ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '';

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col mb-3 ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`flex items-baseline space-x-2 mb-1 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {!isMe && (
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[11px] font-semibold text-amber-400">
                            {m.senderName || m.senderId}
                          </span>
                          {m.senderId === 'system-automation' || m.text.startsWith('[AUTOMATED ACTION]') ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase font-bold">
                              Automated Action
                            </span>
                          ) : selectedChannel?.type === 'parent' ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase font-bold">
                              Parent
                            </span>
                          ) : null}
                        </div>
                      )}
                      {isMe && selectedChannel?.type === 'parent' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase font-bold">
                          Dispatch
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500">{timeStr}</span>
                    </div>

                    <div
                      className={`max-w-[78%] md:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs shadow-sm leading-relaxed ${
                        isMe
                          ? 'bg-amber-500 text-slate-950 font-medium rounded-br-xs'
                          : m.senderId === 'system-automation' || m.text.startsWith('[AUTOMATED ACTION]')
                          ? 'bg-slate-950 border border-emerald-500/40 text-emerald-200 font-mono text-[11px] rounded-xl'
                          : 'bg-slate-800 border border-slate-700/60 text-slate-100 rounded-bl-xs'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Dispatch Reply Templates for Parent Channels */}
          {selectedChannel?.type === 'parent' && (
            <div className="px-3 pt-2.5 pb-2 border-t border-slate-800 bg-slate-950/90">
              <div className="flex items-center space-x-1.5 text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Quick Dispatch Templates</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PARENT_QUICK_REPLIES.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => setInputText(tpl.text)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-amber-500/20 hover:text-amber-300 hover:border-amber-500/30 text-slate-300 border border-slate-700/60 transition font-medium"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message Input Box */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/60">
            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  selectedChannel
                    ? selectedChannel.type === 'parent'
                      ? `Reply to parent ${selectedChannel.name}...`
                      : `Message ${selectedChannel.name}...`
                    : 'Select a channel first'
                }
                disabled={!selectedChannel || sendingMessage}
                className="flex-1 bg-slate-800/80 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!selectedChannel || !inputText.trim() || sendingMessage}
                className="p-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 disabled:hover:bg-amber-500 transition shadow-sm flex items-center justify-center font-bold"
                title="Send"
              >
                {sendingMessage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>
        </div>

      </div>

      {/* MODAL: Contact Picker */}
      {isContactPickerOpen && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-sm text-slate-100">Start Direct Message</h3>
              </div>
              <button
                onClick={() => setIsContactPickerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-slate-800 bg-slate-950/40">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Search by name, route, title or emp #..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Contact List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 p-2">
              {loadingContacts ? (
                <div className="p-8 text-center text-slate-400 flex flex-col items-center space-y-2">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  <span className="text-xs">Loading contacts...</span>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No contacts found matching "{contactSearch}".
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => handleSelectContact(contact)}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-800/70 transition flex items-center justify-between group"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-xs text-amber-300 group-hover:text-amber-200">
                        {contact.displayName}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 mt-0.5">
                        <span>{contact.fullName}</span>
                        <span>•</span>
                        <span>{contact.jobPosition}</span>
                        {contact.empNumber && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[10px] text-slate-400">#{contact.empNumber}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                      Chat
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
