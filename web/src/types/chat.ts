export type ChannelType = 'direct' | 'fleet' | 'office' | 'broadcast' | 'parent';

export interface ChatMember {
  id: string;
  empNumber: string;
  fullName: string;
  displayName: string; // Dynamic: Route + LastName or Title + LastName
  jobPosition: string;
  role: string;
  yardId?: string;
  photoUrl?: string;
}

export interface ChatMessageSummary {
  text: string;
  senderId: string;
  senderName: string;
  createdAt: string;
}

export interface ChatChannel {
  id: string;
  type: ChannelType;
  name: string;
  description?: string;
  yardId?: string;
  yardName?: string;
  memberIds?: string[];
  parentContact?: string;
  parentName?: string;
  studentId?: number | string;
  studentName?: string;
  busUnitNumber?: string;
  routeNo?: string;
  schoolName?: string;
  grade?: string;
  lastMessage?: ChatMessageSummary;
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateParentChannelPayload {
  parentContact: string;
  parentName?: string;
  studentId?: number | string;
  studentName?: string;
  busUnitNumber?: string;
  routeNo?: string;
  schoolName?: string;
  grade?: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'file' | string;
  createdAt: string;
}

export interface SendMessagePayload {
  text: string;
  mediaUrl?: string;
  mediaType?: string;
}
