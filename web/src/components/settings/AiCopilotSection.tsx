import { memo, useEffect, useState } from 'react';
import { aiService } from '../../services/aiService';
import { AICopilotStatus } from '../../types/ai';
import {
  Bot,
  ShieldCheck,
  Sparkles,
  Zap
} from 'lucide-react';

export const AiCopilotSection = memo(function AiCopilotSection() {
  const [aiStatus, setAiStatus] = useState<AICopilotStatus | null>(null);

  useEffect(() => {
    aiService.getStatus().then(setAiStatus).catch(console.error);
  }, []);

  return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-tr from-amber-500 to-indigo-600 text-white rounded-lg shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Dispatch AI Copilot Operations Hub</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {aiStatus?.status === 'online' ? '● Online Active' : 'Offline'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">Dual-engine architecture: Built-in natural language parser + Google Gemini LLM function calling</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center space-x-2 text-xs font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Active Engine: {aiStatus?.engine === 'gemini' ? 'Gemini 2.0/1.5' : 'Built-in Offline Engine'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="font-semibold text-amber-300 flex items-center space-x-1.5">
              <Bot className="w-4 h-4" />
              <span>Supported Dispatch Commands & Dialog</span>
            </div>
            <ul className="space-y-1.5 text-slate-300 text-[11px] list-disc list-inside">
              <li>
                <code className="text-amber-400 bg-slate-900 px-1 py-0.5 rounded">Which shifts lack drivers today?</code>
                <span className="text-slate-400 ml-1">— Real-time scan of vacant shifts with quick assignment</span>
              </li>
              <li>
                <code className="text-amber-400 bg-slate-900 px-1 py-0.5 rounded">Assign Tom as driver on route csdf-001</code>
                <span className="text-slate-400 ml-1">— Matches personnel, vehicle, and route before dispatcher confirmation</span>
              </li>
              <li>
                <code className="text-amber-400 bg-slate-900 px-1 py-0.5 rounded">Show Tom's shifts today</code>
                <span className="text-slate-400 ml-1">— Inspects driver's entire daily schedule and pullaway times</span>
              </li>
              <li>
                <code className="text-amber-400 bg-slate-900 px-1 py-0.5 rounded">Overall dispatch summary today</code>
                <span className="text-slate-400 ml-1">— Statistics for shifts, vacancies, completed runs, and delays</span>
              </li>
            </ul>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="font-semibold text-emerald-300 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Compliance & Safety Safeguards</span>
            </div>
            <div className="text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
              <p>
                🔒 <strong className="text-slate-200">Mandatory Human Confirmation:</strong> AI roster assignments require the dispatcher to click
                <span className="text-emerald-400 font-bold mx-1">"Confirm Execution"</span> before changes take effect.
              </p>
              <p>
                📝 <strong className="text-slate-200">100% Audit Logging:</strong> Every AI command execution is logged to
                <code className="text-slate-300 mx-1">dispatch_change_logs</code> with operator ID, timestamp, and roster diff.
              </p>
              <p>
                ⌨️ <strong className="text-slate-200">Quick Shortcut:</strong> Press
                <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono mx-1 border border-slate-700">Ctrl + J</kbd>
                anywhere in the console to open the AI Copilot.
              </p>
            </div>
          </div>
        </div>
      </div>
  );
});
