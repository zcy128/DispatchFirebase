import React from 'react';
import { ArrowRight, MessageSquare, X } from 'lucide-react';

export interface ChatAlertPayload {
  senderName: string;
  channelName: string;
  text: string;
}

interface ChatAlertToastProps {
  alert: ChatAlertPayload;
  onDismiss: () => void;
  onOpenConversation: () => void;
}

/**
 * Floating in-app notification toast for incoming operations chat messages.
 */
export const ChatAlertToast: React.FC<ChatAlertToastProps> = ({
  alert,
  onDismiss,
  onOpenConversation,
}) => {
  return (
    <div className="fixed top-20 right-6 z-50 max-w-sm w-full bg-slate-900 border-2 border-amber-500/90 rounded-2xl p-3.5 shadow-2xl text-slate-100 flex items-start space-x-3 animate-in slide-in-from-top-3 duration-200">
      <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5 border border-amber-500/30">
        <MessageSquare className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-xs text-amber-400 truncate">{alert.senderName}</h4>
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-white p-0.5"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 truncate">{alert.channelName}</p>
        <p className="text-xs text-slate-200 mt-1 line-clamp-2 leading-relaxed">{alert.text}</p>
        <button
          onClick={onOpenConversation}
          className="mt-2 text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center space-x-1"
        >
          <span>Open Conversation</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
