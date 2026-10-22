import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles,
  Bot,
  Send,
  X,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  RefreshCw,
  Clock,
  ShieldCheck,
  Calendar,
  XCircle,
  ArrowRight,
  User,
  Zap,
  Globe,
  Compass,
  Layers,
  Users,
  Truck,
  GraduationCap,
  Palmtree,
  Receipt,
  DollarSign,
  AlertOctagon,
  ShieldAlert,
  ClipboardCheck,
  BookOpen,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { aiService } from '../../services/aiService';
import { AIChatMessage, AIActionCard, AICopilotStatus } from '../../types/ai';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { normalizeRole, ROLE_LABELS } from '../../utils/permissions';

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate?: string;
  onShiftUpdated?: () => void;
  onNavigateToChangeLog?: (date: string) => void;
}

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({
  isOpen,
  onClose,
  currentDate,
  onShiftUpdated,
  onNavigateToChangeLog,
}) => {
  const { currentUser } = useAuth();
  const { isFrench } = useI18n();

  const userRole = normalizeRole(currentUser?.role);
  const canModifyDispatch =
    userRole === 'admin' ||
    userRole === 'dispatcher' ||
    currentUser?.pagePermissions?.['dispatch'] === 'readwrite';

  const operatorName =
    currentUser?.displayName || currentUser?.email || (isFrench ? 'Régulateur' : 'Dispatcher');

  const todayStr = useMemo(() => {
    if (currentDate) return currentDate;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [currentDate]);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [status, setStatus] = useState<AICopilotStatus | null>(null);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionProcessingId, setActionProcessingId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceAutoRead, setVoiceAutoRead] = useState(false);
  const [copilotLang, setCopilotLang] = useState<'zh' | 'en' | 'fr'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dispatch_ai_lang');
      if (saved === 'zh' || saved === 'en' || saved === 'fr') return saved as 'zh' | 'en' | 'fr';
      const navLang = navigator.language?.toLowerCase() || '';
      if (navLang.startsWith('zh')) return 'zh';
      if (navLang.startsWith('fr')) return 'fr';
    }
    return 'zh';
  });
  const isChinese = copilotLang === 'zh';

  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return window.innerWidth < 640 || params.get('mode') === 'ai' || params.get('ai') === '1';
    }
    return false;
  });
  const [quotaInfo, setQuotaInfo] = useState<{
    used: number;
    limit: number;
    remaining: number;
    exhausted: boolean;
  }>({ used: 0, limit: 15, remaining: 15, exhausted: false });

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const speakReply = (rawText: string) => {
    if (!voiceAutoRead || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const clean = rawText
        .replace(/[#*`_~>-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = isChinese ? 'zh-CN' : isFrench || copilotLang === 'fr' ? 'fr-CA' : 'en-US';
      window.speechSynthesis.speak(utterance);
    } catch {
      // ignore TTS errors
    }
  };

  const toggleVoiceInput = () => {
    setVoiceError(null);
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognitionCtor =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionCtor) {
      setVoiceError(
        isChinese
          ? '语音输入需要 Chrome、Safari 或 Edge 浏览器。'
          : isFrench
          ? 'La reconnaissance vocale nécessite Chrome, Safari ou Edge.'
          : 'Voice input requires Chrome, Safari, or Edge on mobile/desktop.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = isChinese ? 'zh-CN' : isFrench || copilotLang === 'fr' ? 'fr-CA' : 'en-US';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setInputText(transcript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event?.error && event.error !== 'no-speech' && event.error !== 'aborted') {
          setVoiceError(
            isChinese
              ? `麦克风识别错误：${event.error}`
              : isFrench
              ? `Erreur microphone : ${event.error}`
              : `Microphone error: ${event.error}`
          );
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        inputRef.current?.focus();
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      setIsListening(false);
      setVoiceError(e?.message || 'Failed to start microphone');
    }
  };

  useEffect(() => {
    if (currentDate) {
      setSelectedDate(currentDate);
    }
  }, [currentDate]);

  // Load Copilot status & initialize greeting on open
  useEffect(() => {
    if (isOpen) {
      aiService
        .getStatus()
        .then((s) => {
          setStatus(s);
          if (typeof s.quotaLimit === 'number' && s.quotaLimit > 0) {
            setQuotaInfo({
              used: s.quotaUsed || 0,
              limit: s.quotaLimit,
              remaining: s.quotaRemaining ?? s.quotaLimit,
              exhausted: !!s.quotaExhausted,
            });
          }
        })
        .catch(console.error);

      if (messages.length === 0) {
        let welcomeText = '';
        let welcomeQuestions: string[] = [];

        if (userRole === 'HR') {
          welcomeText = isChinese
            ? `您好 **${operatorName}**！我是您的 **校车运营 AI 助手**。\n\n作为 **人事 (HR)**，您可以查询员工档案、跟踪司机驾照资质合规、查看培训与安全隐患列表以及车队状态。\n\n*(注：班次修改权限仅限调度员)*：`
            : isFrench
            ? `Bonjour **${operatorName}** ! Je suis votre **Copilote IA d'opérations**.\n\nEn tant que membre **Ressources Humaines (RH)**, vous pouvez consulter le personnel actif, vérifier la conformité des permis de conduire et inspecter la flotte.\n\n*(Note : La modification des quarts de régulation est réservée aux régulateurs)* :`
            : `Hello **${operatorName}**! I am your **AI Operations Copilot**.\n\nIn your **Human Resources (HR)** role, you can inspect staff records, track CDL driver license compliance, and view fleet status.\n\n*(Note: Shift assignment modifications are restricted to Dispatchers)*:`;
          welcomeQuestions = isChinese
            ? [
                "员工档案与资质合规概览",
                "司机培训课程状态",
                "查看驾驶证资质合规",
                "安全隐患与隐患上报列表",
                "查看车队车辆状态",
              ]
            : isFrench
            ? [
                "Résumé des employés et conformité RH",
                "Statut des formations des chauffeurs",
                "Vérifier la conformité des permis de conduire",
                "Signalements de dangers et quasi-accidents",
                "Statut de la flotte de véhicules",
              ]
            : [
                "HR staff summary & active employees",
                "Driver training courses summary",
                "Check driver license compliance",
                "Active hazard & near-miss reports",
                "Vehicle fleet status",
              ];
        } else if (userRole === 'payroll') {
          welcomeText = isChinese
            ? `您好 **${operatorName}**！我是您的 **校车运营 AI 助手**。\n\n作为 **薪酬/财务**，您可以查阅薪酬费率、路线计费标准与排班工时统计。\n\n*(注：班次修改权限仅限调度员)*：`
            : isFrench
            ? `Bonjour **${operatorName}** ! Je suis votre **Copilote IA d'opérations**.\n\nEn tant que membre **Paie & Rémunération**, vous pouvez consulter les grilles de taux de paie, les barèmes des lignes et les statistiques opérationnelles.\n\n*(Note : La modification des quarts de régulation est réservée aux régulateurs)* :`
            : `Hello **${operatorName}**! I am your **AI Operations Copilot**.\n\nIn your **Payroll & Compensation** role, you can inspect payroll rates, school board base tiers, and operational shift overviews.\n\n*(Note: Shift assignment modifications are restricted to Dispatchers)*:`;
          welcomeQuestions = isChinese
            ? [
                "薪资与排班工时汇总",
                "今日校车调度总览",
                "查看车队车辆状态",
              ]
            : isFrench
            ? [
                "Synthèse des taux de rémunération et de paie",
                "Aperçu de la régulation",
                "Statut de la flotte de véhicules",
              ]
            : [
                "Payroll & compensation rates summary",
                "View today's dispatch overview",
                "Vehicle fleet status",
              ];
        } else {
          welcomeText = isChinese
            ? `您好 **${operatorName}**！我是您的 **校车运营调度 AI 助手**。\n\n我可以协助您进行全系统排班与运营管理：查询缺司机班次、跟进司机排班、分析事故与隐患、评估路线安全、监控车队等：`
            : isFrench
            ? `Bonjour **${operatorName}** ! Je suis votre **Copilote IA d'opérations**.\n\nJe peux vous assister sur l'ensemble du système : vérifier les quarts vacants, inspecter les formations, analyser les incidents et dangers, évaluer la sécurité des lignes, ou surveiller la flotte :`
            : `Hello **${operatorName}**! I am your **AI Operations Copilot**.\n\nI can assist you across all pages: check shift vacancies, inspect driver training, review student incidents & hazards, assess route safety, and inspect the vehicle fleet:`;
          welcomeQuestions = isChinese
            ? [
                "今天有哪些班次缺少司机？",
                "查看车队车辆状态",
                "今日校车调度总览",
                "最近的学生安全事件",
                "安全隐患与隐患上报列表",
                "司机培训课程状态",
              ]
            : isFrench
            ? [
                "Quels quarts n'ont pas de chauffeur aujourd'hui ?",
                "Statut des formations des chauffeurs",
                "Incidents récents impliquant des élèves",
                "Signalements de dangers et quasi-accidents",
                "Évaluations de sécurité des lignes",
                "Statut de la flotte de véhicules",
              ]
            : [
                "Which shifts have no driver today?",
                "Driver training courses summary",
                "Recent student safety incidents",
                "Active hazard & near-miss reports",
                "Route safety assessments overview",
                "Vehicle fleet status",
              ];
        }

        setMessages([
          {
            id: 'welcome',
            sender: 'assistant',
            text: welcomeText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            suggestedQuestions: welcomeQuestions,
          },
        ]);
      }

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, operatorName, isFrench, userRole]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || loading) return;

    const userMsg: AIChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) {
      setInputText('');
    }
    setLoading(true);

    try {
      const resp = await aiService.chat({
        message: text,
        date: selectedDate,
        operatorId: currentUser?.uid || currentUser?.employeeId || operatorName,
        operatorName,
        userRole,
        pagePermissions: currentUser?.pagePermissions as any,
        lang: copilotLang,
      });

      if (typeof resp.quotaLimit === 'number' && resp.quotaLimit > 0) {
        setQuotaInfo({
          used: resp.quotaUsed || 0,
          limit: resp.quotaLimit,
          remaining: resp.quotaRemaining ?? resp.quotaLimit,
          exhausted: !!resp.quotaExhausted,
        });
      }

      const assistantMsg: AIChatMessage = {
        id: `resp-${Date.now()}`,
        sender: 'assistant',
        text: resp.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        cards: resp.actionCards,
        suggestedQuestions: resp.suggestedQuestions,
        engine: resp.engine,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      speakReply(resp.reply);
    } catch (err: any) {
      const errorText = isChinese
        ? `抱歉，处理指令时发生错误：${err.message || '网络连接超时'}`
        : isFrench
        ? `Désolé, une erreur est survenue lors du traitement de la commande : ${err.message || "Délai d'attente dépassé"}`
        : `Sorry, an error occurred while processing command: ${err.message || 'Network timeout'}`;

      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: errorText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (actionId: string, accepted: boolean) => {
    if (actionProcessingId) return;
    setActionProcessingId(actionId);

    const confirmationText = accepted
      ? (isChinese ? '确认执行' : isFrench ? "Confirmer l'exécution" : 'Confirm Execution')
      : (isChinese ? '取消操作' : isFrench ? 'Annuler' : 'Cancel Action');

    const userMsg: AIChatMessage = {
      id: `confirm-msg-${Date.now()}`,
      sender: 'user',
      text: confirmationText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const resp = await aiService.chat({
        message: confirmationText,
        date: selectedDate,
        operatorName,
        userRole,
        pagePermissions: currentUser?.pagePermissions as any,
        actionId,
        confirmed: accepted,
        confirmActionId: actionId,
        confirmAccepted: accepted,
        lang: copilotLang,
      });

      const assistantMsg: AIChatMessage = {
        id: `confirm-resp-${Date.now()}`,
        sender: 'assistant',
        text: resp.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        cards: resp.actionCards,
        suggestedQuestions: resp.suggestedQuestions,
        engine: resp.engine,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (accepted) {
        onShiftUpdated?.();
      }
    } catch (err: any) {
      const failText = isFrench
        ? `Échec de l'exécution : ${err.message || 'Erreur inconnue'}`
        : `Execution failed: ${err.message || 'Unknown error'}`;

      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: failText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setActionProcessingId(null);
      setLoading(false);
    }
  };

  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-1 text-sm leading-relaxed">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-2" />;

          // Header
          if (line.startsWith('### ')) {
            return (
              <h4 key={idx} className="font-bold text-amber-300 text-base mt-2 mb-1">
                {line.replace('### ', '')}
              </h4>
            );
          }

          // Bullet point
          const isBullet = line.startsWith('- ') || line.startsWith('* ');
          const lineContent = isBullet ? line.slice(2) : line;

          // Simple bold and code parsing
          const parts = lineContent.split(/(\*\*.*?\*\*|`.*?`)/g);

          const renderedLine = parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-semibold text-amber-200">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            if (part.startsWith('`') && part.endsWith('`')) {
              return (
                <code
                  key={pIdx}
                  className="bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded text-xs font-mono border border-slate-700"
                >
                  {part.slice(1, -1)}
                </code>
              );
            }
            return part;
          });

          return (
            <div key={idx} className={isBullet ? 'flex items-start space-x-2 pl-2' : ''}>
              {isBullet && <span className="text-amber-400 mt-1">•</span>}
              <div className="flex-1">{renderedLine}</div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderActionCard = (card: AIActionCard, msgId: string) => {
    switch (card.type) {
      case 'unassigned_shifts': {
        const shifts = card.data?.shifts || [];
        return (
          <div
            key={`${msgId}-unassigned`}
            className="mt-3 bg-slate-900/90 border border-amber-500/30 rounded-xl p-3.5 space-y-2.5 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-amber-400 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>{card.title || (isFrench ? 'Quarts non assignés' : 'Unassigned Shifts')}</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {isFrench ? 'Date :' : 'Date:'} {card.data?.date}
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {shifts.map((sh: any, sIdx: number) => (
                <div
                  key={sIdx}
                  className="bg-slate-800/80 border border-slate-700/60 rounded-lg p-2.5 flex items-center justify-between text-xs hover:border-amber-500/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
                        {sh.routeNo}
                      </span>
                      <span className="text-slate-200 font-medium truncate">
                        {sh.routeName || (isFrench ? 'Ligne Standard' : 'Standard Route')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center space-x-2">
                      <span className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px] text-slate-300 uppercase">
                        {sh.shiftType}
                      </span>
                      {sh.firstStopTime && (
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{sh.firstStopTime}</span>
                        </span>
                      )}
                      {sh.yardName && <span className="text-slate-500">· {sh.yardName}</span>}
                    </div>
                  </div>

                  {canModifyDispatch ? (
                    <button
                      onClick={() => {
                        const template = isFrench
                          ? `Assigner Tom sur la ligne ${sh.routeNo}`
                          : `Assign Tom to route ${sh.routeNo}`;
                        setInputText(template);
                        inputRef.current?.focus();
                      }}
                      className="ml-2 px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-semibold rounded-md border border-amber-500/40 text-[11px] flex items-center space-x-1 transition-all whitespace-nowrap"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{isFrench ? 'Assigner' : 'Assign'}</span>
                    </button>
                  ) : (
                    <span className="ml-2 px-2 py-1 text-[10px] text-slate-500 bg-slate-800/80 rounded border border-slate-700/60 whitespace-nowrap">
                      {isFrench ? 'Lecture seule' : 'Read-only'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'confirm_action': {
        const d = card.data || {};
        const isCurrentProcessing = actionProcessingId === card.actionId;
        return (
          <div
            key={`${msgId}-confirm`}
            className="mt-3 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border-2 border-amber-500 rounded-xl p-4 shadow-xl space-y-3"
          >
            <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
              <span>
                {isFrench
                  ? '🚨 Affectation en attente - Veuillez confirmer'
                  : '🚨 Pending Assignment - Please Confirm'}
              </span>
            </div>

            {d.actionType === 'CREATE_DISPATCH_SHEET' ? (
              <div className="bg-slate-800/90 rounded-lg p-3 space-y-1.5 text-xs border border-slate-700/80">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Opération :' : 'Action:'}</span>
                  <span className="font-bold text-amber-300">
                    {isFrench ? 'Création de la feuille de régulation' : 'Generate Daily Dispatch Sheet'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Date ciblée :' : 'Target Date:'}</span>
                  <span className="font-mono font-bold text-emerald-400">{d.date}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-t border-slate-700/60 pt-1">
                  <span className="text-slate-400">{isFrench ? 'Périmètre :' : 'Scope:'}</span>
                  <span className="text-slate-300">
                    {isFrench ? 'Toutes les lignes maîtresses actives' : 'All active master routes'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/90 rounded-lg p-3 space-y-1.5 text-xs border border-slate-700/80">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Ligne :' : 'Route:'}</span>
                  <span className="font-mono font-bold text-amber-300">
                    {d.routeNo} {d.routeName ? `(${d.routeName})` : ''}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Chauffeur :' : 'Driver:'}</span>
                  <span className="font-bold text-emerald-400 flex items-center space-x-1">
                    <User className="w-3.5 h-3.5" />
                    <span>{d.driverName}</span>
                    {d.driverId && <span className="text-slate-500 font-mono">({d.driverId})</span>}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Quart :' : 'Shift:'}</span>
                  <span className="text-slate-200">
                    {d.shiftType || (isFrench ? 'Tous les quarts' : 'All Shifts')}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Date :' : 'Date:'}</span>
                  <span className="font-mono text-slate-300">{d.date}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-t border-slate-700/60 pt-1">
                  <span className="text-slate-400">{isFrench ? 'Ancien chauffeur :' : 'Previous Driver:'}</span>
                  <span className="text-slate-400 italic">
                    {d.oldDriverName || (isFrench ? 'Non assigné' : 'Unassigned')}
                  </span>
                </div>
              </div>
            )}

            {!canModifyDispatch ? (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>
                  {isFrench
                    ? `Action restreinte : Votre rôle (${ROLE_LABELS[userRole] || userRole}) ne peut pas modifier les quarts de régulation.`
                    : `Action restricted: Your role (${ROLE_LABELS[userRole] || userRole}) cannot modify dispatch shifts.`}
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 pt-1">
                <button
                  disabled={isCurrentProcessing || loading}
                  onClick={() => handleConfirmAction(card.actionId || '', true)}
                  className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-950 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isCurrentProcessing
                      ? (isFrench ? 'Envoi...' : 'Submitting...')
                      : (isFrench ? "Confirmer l'exécution" : 'Confirm & Execute')}
                  </span>
                </button>

                <button
                  disabled={isCurrentProcessing || loading}
                  onClick={() => handleConfirmAction(card.actionId || '', false)}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-white font-medium rounded-lg text-xs flex items-center justify-center space-x-1 border border-slate-600 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  <span>{isFrench ? 'Annuler' : 'Cancel'}</span>
                </button>
              </div>
            )}

            <p className="text-[11px] text-amber-400/80 text-center flex items-center justify-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {isFrench
                  ? "Toutes les actions sont consignées dans le journal d'audit de régulation"
                  : 'All actions are automatically recorded in the Dispatch Audit Log'}
              </span>
            </p>
          </div>
        );
      }

      case 'action_success': {
        const d = card.data || {};
        const isSheetAction = d.actionType === 'CREATE_DISPATCH_SHEET';
        return (
          <div
            key={`${msgId}-success`}
            className="mt-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3.5 space-y-2 shadow-lg"
          >
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                {card.title ||
                  (isSheetAction
                    ? (isFrench ? 'Feuille de régulation créée avec succès' : 'Dispatch Sheet Created Successfully')
                    : (isFrench ? 'Horaire de régulation mis à jour avec succès' : 'Dispatch Schedule Updated Successfully'))}
              </span>
            </div>
            <div className="text-xs text-slate-300 leading-relaxed">
              {isSheetAction ? (
                isFrench ? (
                  <>
                    La feuille de régulation pour le <strong className="text-emerald-300">{d.date || selectedDate}</strong> a été générée avec succès à partir des lignes maîtresses actives.
                  </>
                ) : (
                  <>
                    Daily dispatch sheet for <strong className="text-emerald-300">{d.date || selectedDate}</strong> has been successfully generated from active master routes.
                  </>
                )
              ) : isFrench ? (
                <>
                  La ligne <strong className="text-emerald-300">{d.routeNo}</strong> a été assignée avec succès à{' '}
                  <strong className="text-white">{d.driverName}</strong>. Journal d'audit mis à jour.
                </>
              ) : (
                <>
                  Route <strong className="text-emerald-300">{d.routeNo}</strong> has been successfully assigned to{' '}
                  <strong className="text-white">{d.driverName}</strong>. Audit log created.
                </>
              )}
            </div>
            {onNavigateToChangeLog && (
              <button
                onClick={() => onNavigateToChangeLog(d.date || selectedDate)}
                className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 mt-1 pt-1 border-t border-emerald-900/40 w-full"
              >
                <span>
                  {isFrench ? 'Consulter le journal des modifications' : 'View Dispatch Change Log'}
                </span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      }

      case 'creator_info': {
        const d = card.data || {};
        return (
          <div
            key={`${msgId}-creator`}
            className="mt-3 bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-indigo-500/40 rounded-xl p-3.5 space-y-2.5 shadow-lg"
          >
            <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>{card.title || (isFrench ? 'Création de la feuille de régulation' : 'Dispatch Creation Info')}</span>
            </div>
            <div className="bg-slate-800/90 rounded-lg p-2.5 space-y-1.5 text-xs border border-slate-700/60">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">{isFrench ? 'Créateur initial :' : 'Created by:'}</span>
                <span className="font-semibold text-white">{d.creator || 'System Dispatcher'}</span>
              </div>
              {d.createdTime && (
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Horodatage :' : 'Timestamp:'}</span>
                  <span className="text-slate-300 font-mono text-[11px]">{d.createdTime}</span>
                </div>
              )}
              {d.totalShifts !== undefined && (
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Quarts en cours :' : 'Active Shifts:'}</span>
                  <span className="text-indigo-300 font-semibold">
                    {d.totalShifts} {isFrench ? 'quarts' : 'shifts'} ({d.assignedShifts || 0} {isFrench ? 'assignés' : 'assigned'})
                  </span>
                </div>
              )}
              {d.isColdArchive && (
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Source :' : 'Source:'}</span>
                  <span className="text-cyan-300 font-mono text-[10px] bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.5 rounded">
                    🧊 BigQuery Archive (&gt;60d)
                  </span>
                </div>
              )}
            </div>
            {onNavigateToChangeLog && (
              <button
                onClick={() => onNavigateToChangeLog(d.date || selectedDate)}
                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 mt-1 pt-1 border-t border-slate-700/50 w-full"
              >
                <span>{isFrench ? 'Consulter le journal des modifications' : 'View Dispatch Change Log'}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      }

      case 'route_details': {
        const d = card.data || {};
        return (
          <div
            key={`${msgId}-route-details`}
            className="mt-3 bg-gradient-to-br from-slate-900 to-sky-950/40 border border-sky-500/40 rounded-xl p-3.5 space-y-2.5 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-sky-400 font-bold text-xs">
                <Compass className="w-4 h-4 text-sky-400" />
                <span>{card.title || `Route ${d.routeNo}`}</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/40 text-sky-300">
                {d.status || 'Active'}
              </span>
            </div>
            <div className="bg-slate-800/90 rounded-lg p-2.5 space-y-1.5 text-xs border border-slate-700/60">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">{isFrench ? 'Dépôt (Yard) :' : 'Depot / Yard:'}</span>
                <span className="font-semibold text-white">{d.yardName || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">{isFrench ? 'Chauffeur titulaire :' : 'Master Driver:'}</span>
                <span className="font-semibold text-amber-300">{d.masterDriver || (isFrench ? 'Aucun' : 'Unassigned')}</span>
              </div>
              {d.masterAttendant && d.masterAttendant !== 'None' && (
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Accompagnateur :' : 'Attendant:'}</span>
                  <span className="text-slate-300">{d.masterAttendant}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">{isFrench ? 'Véhicule par défaut :' : 'Default Unit:'}</span>
                <span className="font-mono text-slate-300">{d.masterUnit || 'N/A'}</span>
              </div>
              {d.shiftsCount !== undefined && (
                <div className="flex justify-between items-center py-0.5 border-t border-slate-700/50 pt-1">
                  <span className="text-slate-400">{isFrench ? "Quarts aujourd'hui :" : "Today's Shifts:"}</span>
                  <span className="text-emerald-400 font-semibold">{d.shiftsCount}</span>
                </div>
              )}
            </div>
          </div>
        );
      }

      case 'route_summary': {
        const d = card.data || {};
        return (
          <div
            key={`${msgId}-route-summary`}
            className="mt-3 bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-indigo-500/40 rounded-xl p-3.5 space-y-2.5 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>{card.title || (isFrench ? 'Synthèse des Lignes' : 'Route Fleet Summary')}</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/40 text-indigo-300">
                {d.totalRoutes || 0} {isFrench ? 'lignes' : 'routes'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Actives / Inactives' : 'Active / Inactive'}</span>
                <span className="font-bold text-emerald-400">{d.activeRoutes || 0}</span>
                <span className="text-slate-500 text-[11px]"> / {d.inactiveRoutes || 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Chauffeurs titulaires' : 'Default Drivers'}</span>
                <span className="font-bold text-amber-300">{d.assignedDrivers || 0}</span>
                <span className="text-slate-500 text-[11px]"> ({d.unassignedDrivers || 0} {isFrench ? 'vacants' : 'open'})</span>
              </div>
            </div>
          </div>
        );
      }

      case 'assignment_summary': {
        const d = card.data || {};
        return (
          <div
            key={`${msgId}-assignment-summary`}
            className="mt-3 bg-gradient-to-br from-slate-900 to-teal-950/40 border border-teal-500/40 rounded-xl p-3.5 space-y-2.5 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-teal-400 font-bold text-xs">
                <Users className="w-4 h-4 text-teal-400" />
                <span>{card.title || (isFrench ? 'État des Affectations' : 'Shift Assignments Overview')}</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-teal-950/60 border border-teal-800/40 text-teal-300">
                {d.coverageRate || '0%'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Quarts couverts' : 'Covered Shifts'}</span>
                <span className="font-bold text-emerald-400">{d.assignedShifts || 0}</span>
                <span className="text-slate-500 text-[11px]"> / {d.totalShifts || 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Quarts vacants' : 'Vacant Shifts'}</span>
                <span className={`font-bold ${d.unassignedShifts > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {d.unassignedShifts || 0}
                </span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Pointés (Checked-In)' : 'Checked-In Drivers'}</span>
                <span className="font-bold text-sky-400">{d.checkedInCount || 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Remplacements' : 'Temporary Subs'}</span>
                <span className="font-bold text-purple-400">{d.tempCount || 0}</span>
              </div>
            </div>
          </div>
        );
      }

      case 'vehicle_details': {
        const d = card.data || {};
        return (
          <div
            key={`${msgId}-vehicle-details`}
            className="mt-3 bg-gradient-to-br from-slate-900 to-amber-950/40 border border-amber-500/40 rounded-xl p-3.5 space-y-2.5 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs">
                <Truck className="w-4 h-4 text-amber-400" />
                <span>{card.title || `Vehicle ${d.unitNumber}`}</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/40 text-amber-300">
                {d.status || 'In Service'}
              </span>
            </div>
            <div className="bg-slate-800/90 rounded-lg p-2.5 space-y-1.5 text-xs border border-slate-700/60">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">{isFrench ? 'Modèle :' : 'Model:'}</span>
                <span className="font-semibold text-white">{d.model || 'Standard'}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">{isFrench ? 'Plaque d\'immatriculation :' : 'Plate:'}</span>
                <span className="font-mono text-slate-300">{d.plateNumber || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">{isFrench ? 'Dépôt (Yard) :' : 'Depot / Yard:'}</span>
                <span className="font-semibold text-white">{d.yardName || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">{isFrench ? 'Chauffeur attitré :' : 'Assigned Driver:'}</span>
                <span className="font-semibold text-amber-300">{d.assignedDriver || (isFrench ? 'Aucun' : 'Unassigned')}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">{isFrench ? 'Ligne attitrée :' : 'Assigned Route:'}</span>
                <span className="font-mono text-emerald-400">{d.assignedRoute || 'None'}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-t border-slate-700/50 pt-1">
                <span className="text-slate-400">{isFrench ? 'Capacité :' : 'Capacity:'}</span>
                <span className="text-slate-300">
                  {d.seatCap || 0} {isFrench ? 'sièges' : 'seats'}
                  {d.wheelchairCap ? ` · ${d.wheelchairCap} ♿` : ''}
                </span>
              </div>
            </div>
          </div>
        );
      }

      case 'vehicle_summary': {
        const d = card.data || {};
        return (
          <div
            key={`${msgId}-vehicle-summary`}
            className="mt-3 bg-gradient-to-br from-slate-900 to-amber-950/40 border border-amber-500/40 rounded-xl p-3.5 space-y-2.5 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs">
                <Truck className="w-4 h-4 text-amber-400" />
                <span>{card.title || (isFrench ? 'État de la Flotte de Véhicules' : 'Fleet Vehicle Overview')}</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/40 text-amber-300">
                {d.totalVehicles || 0} {isFrench ? 'véhicules' : 'vehicles'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'En service' : 'In Service'}</span>
                <span className="font-bold text-emerald-400">{d.active || 0}</span>
                <span className="text-slate-500 text-[11px]"> ({d.spare || 0} {isFrench ? 'réserves' : 'spares'})</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'En maintenance' : 'Maintenance / Repair'}</span>
                <span className={`font-bold ${d.inMaintenance > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {d.inMaintenance || 0}
                </span>
                <span className="text-slate-500 text-[11px]"> / {d.outOfService || 0} {isFrench ? 'hors service' : 'OOS'}</span>
              </div>
            </div>
          </div>
        );
      }

      case 'student_details': {
        const d = card.data || {};
        return (
          <div
            key={`${msgId}-student-details`}
            className="mt-3 bg-gradient-to-br from-slate-900 to-blue-950/40 border border-blue-500/40 rounded-xl p-3.5 space-y-2.5 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs">
                <GraduationCap className="w-4 h-4 text-blue-400" />
                <span>{card.title || `${d.name} (${d.studentNo})`}</span>
              </div>
              {d.metatBus && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-950/80 border border-purple-700 text-purple-300">
                  ⚠️ MetatBus
                </span>
              )}
            </div>
            <div className="bg-slate-800/90 rounded-lg p-2.5 space-y-1.5 text-xs border border-slate-700/60">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">{isFrench ? 'École :' : 'School:'}</span>
                <span className="font-semibold text-white">{d.school || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">{isFrench ? 'Niveau (Grade) :' : 'Grade:'}</span>
                <span className="text-slate-300 font-mono">{d.grade || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">{isFrench ? 'Ligne(s) assignée(s) :' : 'Assigned Route(s):'}</span>
                <span className="font-mono font-bold text-amber-300">{d.routes || 'None'}</span>
              </div>
              {d.stopTime && (
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Arrêt / Heure :' : 'Stop / Time:'}</span>
                  <span className="text-emerald-400 font-mono text-[11px] truncate max-w-[200px]">
                    {d.stopTime} {d.stopLocation ? `· ${d.stopLocation}` : ''}
                  </span>
                </div>
              )}
              {d.contactName && (
                <div className="flex justify-between items-center py-0.5 border-t border-slate-700/50 pt-1">
                  <span className="text-slate-400">{isFrench ? 'Contact d\'urgence :' : 'Emergency Contact:'}</span>
                  <span className="text-slate-200">
                    {d.contactName} {d.contactPhone ? `(${d.contactPhone})` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      }

      case 'student_summary': {
        const d = card.data || {};
        return (
          <div
            key={`${msgId}-student-summary`}
            className="mt-3 bg-gradient-to-br from-slate-900 to-blue-950/40 border border-blue-500/40 rounded-xl p-3.5 space-y-2.5 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs">
                <GraduationCap className="w-4 h-4 text-blue-400" />
                <span>{card.title || (isFrench ? 'Synthèse des Élèves' : 'Student Transportation Overview')}</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/40 text-blue-300">
                {d.totalStudents || 0} {isFrench ? 'élèves' : 'students'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Élèves actifs' : 'Active Students'}</span>
                <span className="font-bold text-emerald-400">{d.activeStudents || 0}</span>
                <span className="text-slate-500 text-[11px]"> / {d.totalStudents || 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'MetatBus (Accueil)' : 'MetatBus Escort'}</span>
                <span className="font-bold text-purple-400">{d.metatBusCount || 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60 col-span-2 flex justify-between items-center">
                <span className="text-slate-400 text-[11px]">{isFrench ? 'Écoles desservies :' : 'Schools Served:'}</span>
                <span className="font-bold text-sky-400 font-mono">{d.schoolsCount || 0}</span>
              </div>
            </div>
          </div>
        );
      }

      case 'employee_details': {
        const d = card.data || {};
        return (
          <div
            key={`${msgId}-employee-details`}
            className="mt-3 bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-indigo-500/40 rounded-xl p-3.5 space-y-2.5 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs">
                <User className="w-4 h-4 text-indigo-400" />
                <span>{card.title || `${d.fullName} (#${d.employeeNumber})`}</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/40 text-indigo-300">
                {d.jobPosition || 'Staff'}
              </span>
            </div>
            <div className="bg-slate-800/90 rounded-lg p-2.5 space-y-1.5 text-xs border border-slate-700/60">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">{isFrench ? 'Matricule :' : 'Employee #:'}</span>
                <span className="font-mono text-slate-300">{d.employeeNumber || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">{isFrench ? 'Téléphone :' : 'Phone:'}</span>
                <span className="font-mono text-emerald-400">{d.phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">{isFrench ? 'Courriel :' : 'Email:'}</span>
                <span className="text-slate-300 text-[11px] truncate max-w-[200px]">{d.email || 'N/A'}</span>
              </div>
              {d.licenseClass && d.licenseClass !== 'N/A' && (
                <div className="flex justify-between items-center py-0.5 border-t border-slate-700/50 pt-1">
                  <span className="text-slate-400">{isFrench ? 'Permis de conduire :' : 'CDL License:'}</span>
                  <span className="font-mono text-amber-300">
                    {d.licenseClass} (Exp: {d.licenseExpiry || 'N/A'})
                  </span>
                </div>
              )}
              {d.shiftsCount !== undefined && (
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Quarts aujourd\'hui :' : "Today's Shifts:"}</span>
                  <span className="text-sky-400 font-semibold">{d.shiftsCount}</span>
                </div>
              )}
            </div>
          </div>
        );
      }

      case 'employee_summary': {
        const d = card.data || {};
        return (
          <div
            key={`${msgId}-employee-summary`}
            className="mt-3 bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-indigo-500/40 rounded-xl p-3.5 space-y-2.5 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>{card.title || (isFrench ? 'Personnel & Chauffeurs' : 'Staff & Drivers Overview')}</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/40 text-indigo-300">
                {d.totalEmployees || 0} {isFrench ? 'employés' : 'staff'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Chauffeurs' : 'Bus Drivers'}</span>
                <span className="font-bold text-amber-300">{d.driverCount || 0}</span>
                <span className="text-slate-500 text-[11px]"> / {d.activeEmployees || 0} {isFrench ? 'actifs' : 'active'}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Accompagnateurs' : 'Attendants'}</span>
                <span className="font-bold text-emerald-400">{d.attendantCount || 0}</span>
              </div>
              {d.expiringLicenses > 0 && (
                <div className="bg-amber-950/40 border border-amber-600/40 rounded-lg p-2 col-span-2 flex items-center justify-between">
                  <span className="text-amber-300 text-[11px] flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isFrench ? 'Permis expirant (< 30j) :' : 'Licenses Expiring (<30d):'}</span>
                  </span>
                  <span className="font-bold text-amber-400 font-mono">{d.expiringLicenses}</span>
                </div>
              )}
            </div>
          </div>
        );
      }

      case 'time_off_summary': {
        const d = card.data || {};
        return (
          <div
            key={`${msgId}-time-off-summary`}
            className="mt-3 bg-gradient-to-br from-slate-900 to-teal-950/40 border border-teal-500/40 rounded-xl p-3.5 space-y-2.5 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-teal-400 font-bold text-xs">
                <Palmtree className="w-4 h-4 text-teal-400" />
                <span>{card.title || (isFrench ? 'Synthèse des congés' : 'Time Off Summary')}</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-teal-950/60 border border-teal-800/40 text-teal-300">
                {d.totalRequests || 0} {isFrench ? 'demandes' : 'requests'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'En attente (Pending)' : 'Pending Review'}</span>
                <span className={`font-bold ${d.pendingCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-300'}`}>
                  {d.pendingCount || 0}
                </span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'En congé aujourd\'hui' : 'On Leave Today'}</span>
                <span className="font-bold text-emerald-400">{d.activeTodayCount || 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60 col-span-2 flex justify-between items-center">
                <span className="text-slate-400 text-[11px]">{isFrench ? 'Total approuvées :' : 'Total Approved:'}</span>
                <span className="font-bold text-teal-300 font-mono">{d.approvedCount || 0}</span>
              </div>
            </div>
          </div>
        );
      }

      case 'time_off_details': {
        const d = card.data || {};
        const items = d.items as any[];
        return (
          <div
            key={`${msgId}-time-off-details`}
            className="mt-3 bg-gradient-to-br from-slate-900 to-teal-950/40 border border-teal-500/40 rounded-xl p-3.5 space-y-2.5 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-teal-400 font-bold text-xs">
                <Palmtree className="w-4 h-4 text-teal-400" />
                <span>{card.title || (isFrench ? 'Détails du congé' : 'Time Off Details')}</span>
              </div>
              {d.status && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                  d.status === 'approved' ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-300' :
                  d.status === 'pending' ? 'bg-amber-950/80 border border-amber-700 text-amber-300' :
                  'bg-rose-950/80 border border-rose-700 text-rose-300'
                }`}>
                  {d.status}
                </span>
              )}
            </div>

            {items && items.length > 0 ? (
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {items.map((it: any, idx: number) => (
                  <div key={idx} className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-slate-200">{it.employeeName}</div>
                      <div className="text-[10px] text-slate-400">{it.leaveType} · {it.startDate} → {it.endDate}</div>
                    </div>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 uppercase">
                      {it.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-800/90 rounded-lg p-2.5 space-y-1.5 text-xs border border-slate-700/60">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Employé :' : 'Employee:'}</span>
                  <span className="font-semibold text-white">{d.employeeName || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Motif (Type) :' : 'Leave Type:'}</span>
                  <span className="font-mono text-teal-300">{d.leaveType || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Période :' : 'Dates:'}</span>
                  <span className="font-mono text-slate-300">{d.startDate} → {d.endDate}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Quart(s) :' : 'Shift(s):'}</span>
                  <span className="text-slate-300">{d.shiftType || 'ALL'}</span>
                </div>
                {d.comments && (
                  <div className="py-0.5 border-t border-slate-700/50 pt-1 text-[11px] text-slate-300 italic">
                    "{d.comments}"
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      case 'expense_summary': {
        const d = card.data || {};
        return (
          <div
            key={`${msgId}-expense-summary`}
            className="mt-3 bg-gradient-to-br from-slate-900 to-emerald-950/40 border border-emerald-500/40 rounded-xl p-3.5 space-y-2.5 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>{card.title || (isFrench ? 'Notes de frais & Remboursements' : 'Expense Claims Summary')}</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-300">
                ${Number(d.totalAmount || 0).toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'En attente' : 'Pending Review'}</span>
                <span className={`font-bold ${d.pendingCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-300'}`}>
                  {d.pendingCount || 0} claims (${Number(d.pendingAmount || 0).toFixed(2)})
                </span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Approuvées & Réglées' : 'Approved & Settled'}</span>
                <span className="font-bold text-emerald-400">
                  {d.approvedCount || 0} (${Number(d.approvedAmount || 0).toFixed(2)})
                </span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60 col-span-2 flex justify-between items-center">
                <span className="text-slate-400 text-[11px]">{isFrench ? 'Nombre total de réclamations :' : 'Total Claims Count:'}</span>
                <span className="font-bold text-emerald-300 font-mono">{d.totalClaims || 0}</span>
              </div>
            </div>
          </div>
        );
      }

      case 'expense_details': {
        const d = card.data || {};
        const items = d.items as any[];
        const lines = d.lines as any[];
        return (
          <div
            key={`${msgId}-expense-details`}
            className="mt-3 bg-gradient-to-br from-slate-900 to-emerald-950/40 border border-emerald-500/40 rounded-xl p-3.5 space-y-2.5 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>{card.title || (isFrench ? 'Note de frais' : 'Expense Details')}</span>
              </div>
              {d.totalAmount !== undefined && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-300 font-bold">
                  ${Number(d.totalAmount).toFixed(2)}
                </span>
              )}
            </div>

            {items && items.length > 0 ? (
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {items.map((it: any, idx: number) => (
                  <div key={idx} className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-slate-200">{it.employeeName}</div>
                      <div className="text-[10px] text-slate-400">Date: {it.claimDate} · Route: {it.routeNo || 'N/A'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-400">${Number(it.totalAmount).toFixed(2)}</div>
                      <span className="text-[9px] uppercase px-1 py-0.5 bg-slate-700 rounded text-slate-300">{it.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-800/90 rounded-lg p-2.5 space-y-1.5 text-xs border border-slate-700/60">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Employé :' : 'Employee:'}</span>
                  <span className="font-semibold text-white">{d.employeeName || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Date :' : 'Claim Date:'}</span>
                  <span className="font-mono text-slate-300">{d.claimDate || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Ligne :' : 'Route:'}</span>
                  <span className="font-mono text-amber-300">{d.routeNo || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Statut :' : 'Status:'}</span>
                  <span className="font-semibold text-emerald-400 uppercase text-[10px]">{d.status}</span>
                </div>
                {lines && lines.length > 0 && (
                  <div className="border-t border-slate-700/50 pt-1 space-y-1">
                    <span className="text-[10px] text-slate-400 block">{isFrench ? 'Lignes de dépenses :' : 'Breakdown:'}</span>
                    {lines.map((ln: any, lIdx: number) => (
                      <div key={lIdx} className="flex justify-between text-[11px] text-slate-300">
                        <span>{ln.category} {ln.note ? `(${ln.note})` : ''}</span>
                        <span className="font-mono font-semibold">${Number(ln.amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      case 'payroll_summary': {
        const d = card.data || {};
        return (
          <div
            key={`${msgId}-payroll-summary`}
            className="mt-3 bg-gradient-to-br from-slate-900 to-amber-950/40 border border-amber-500/40 rounded-xl p-3.5 space-y-2.5 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <span>{card.title || (isFrench ? 'Grilles de taux et rémunération' : 'Payroll Rates Summary')}</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/40 text-amber-300">
                {d.totalRates || 0} {isFrench ? 'grilles' : 'rules'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Barèmes conseils scolaires' : 'Board Baseline (Tier 4)'}</span>
                <span className="font-bold text-sky-400">{d.schoolBoardRatesCount || 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Dérogations spécifiques' : 'Custom Overrides (T1-T3)'}</span>
                <span className="font-bold text-amber-300">{d.customCount || 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60 col-span-2 flex justify-between items-center text-[11px]">
                <span className="text-slate-400">{isFrench ? 'Hiérarchie des règles :' : 'Arbitration Rules:'}</span>
                <span className="font-mono text-emerald-400 font-semibold">{isFrench ? '4 Niveaux Prioritaires' : '4-Tier Priority Engine'}</span>
              </div>
            </div>
          </div>
        );
      }

      case 'payroll_details': {
        const d = card.data || {};
        const items = d.items as any[];
        return (
          <div
            key={`${msgId}-payroll-details`}
            className="mt-3 bg-gradient-to-br from-slate-900 to-amber-950/40 border border-amber-500/40 rounded-xl p-3.5 space-y-2.5 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <span>{card.title || (isFrench ? 'Barème de rémunération' : 'Payroll Rate Details')}</span>
              </div>
              {d.payRate && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700 text-emerald-300 font-bold">
                  {d.payRate}
                </span>
              )}
            </div>

            {items && items.length > 0 ? (
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {items.map((it: any, idx: number) => (
                  <div key={idx} className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-slate-200">{it.id} ({it.jobTitle})</div>
                      <div className="text-[10px] text-slate-400">
                        {it.routeNo ? `Route ${it.routeNo}` : it.schoolBoardCode || 'All'} · {it.shiftType || 'All Shifts'}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-emerald-400">{it.payRate}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-800/90 rounded-lg p-2.5 space-y-1.5 text-xs border border-slate-700/60">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Conseil scolaire :' : 'School Board:'}</span>
                  <span className="font-semibold text-white">{d.schoolBoardName || d.schoolBoardCode || 'Universal'}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Poste / Rôle :' : 'Job Role:'}</span>
                  <span className="font-mono text-amber-300 uppercase">{d.jobTitle}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Taux horaire :' : 'Pay Rate:'}</span>
                  <span className="font-mono font-bold text-emerald-400">{d.payRate}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">{isFrench ? 'Heures EI :' : 'Insurable EI Hours:'}</span>
                  <span className="font-mono text-sky-400">{d.eiHours}</span>
                </div>
                {d.routeNo && (
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400">{isFrench ? 'Ligne ciblée :' : 'Target Route:'}</span>
                    <span className="font-mono text-amber-300">{d.routeNo}</span>
                  </div>
                )}
                {d.employeeName && (
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400">{isFrench ? 'Chauffeur :' : 'Employee:'}</span>
                    <span className="font-semibold text-white">{d.employeeName}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      case 'dispatch_payroll_summary': {
        const d = card.data || {};
        return (
          <div
            key={`${msgId}-dispatch-payroll`}
            className="mt-3 bg-gradient-to-br from-slate-900 to-amber-950/40 border border-amber-500/40 rounded-xl p-3.5 space-y-2.5 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <span>{card.title || (isFrench ? 'Paie du dispatch (Quarts)' : 'Dispatch Shift Payroll')}</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700 text-emerald-300 font-bold">
                ${Number(d.totalLiability || 0).toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Quarts avec paie' : 'Payroll Shifts'}</span>
                <span className="font-bold text-white">{d.totalRecords || 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Total heures EI' : 'Total EI Hours'}</span>
                <span className="font-bold text-sky-400">{Number(d.totalEiHours || 0).toFixed(1)} hrs</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'En attente sortie' : 'Pending Checkout'}</span>
                <span className="font-bold text-slate-300">{d.pendingCheckoutCount || 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'En attente validation' : 'Pending Approval'}</span>
                <span className={`font-bold ${d.pendingApprovalCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-300'}`}>
                  {d.pendingApprovalCount || 0}
                </span>
              </div>
            </div>
          </div>
        );
      }

      case 'training_summary': {
        const d = card.data || {};
        const upcoming = d.upcoming || d.items || [];
        return (
          <div
            key={`${msgId}-training-summary`}
            className="mt-3 bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3.5 space-y-3 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-xs">
                <GraduationCap className="w-4 h-4 text-indigo-400" />
                <span>{card.title || (isFrench ? 'Synthèse des formations' : 'Training Summary')}</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {d.total ?? upcoming.length} {isFrench ? 'sessions' : 'sessions'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Publiées' : 'Published'}</span>
                <span className="font-bold text-emerald-400">{d.publishedCount ?? 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Terminées' : 'Completed'}</span>
                <span className="font-bold text-sky-400">{d.completedCount ?? 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Brouillons' : 'Drafts'}</span>
                <span className="font-bold text-slate-300">{d.draftCount ?? 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Inscrits' : 'Enrolled'}</span>
                <span className="font-bold text-indigo-300">{d.totalRegistered ?? 0}</span>
              </div>
            </div>

            {upcoming.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  {isFrench ? 'Prochaines sessions' : 'Upcoming Sessions'}
                </span>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {upcoming.map((c: any, cIdx: number) => (
                    <div
                      key={cIdx}
                      className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-2 flex items-center justify-between text-xs hover:border-indigo-500/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-200 truncate">{c.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {c.startDate} · {c.instructorName || c.trainingTypeName}
                        </div>
                      </div>
                      <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-800/40 shrink-0">
                        {c.registeredCount ?? 0}/{c.capacity ?? '-'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      }

      case 'training_details': {
        const d = card.data || {};
        return (
          <div
            key={`${msgId}-training-details`}
            className="mt-3 bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3.5 space-y-3 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-xs">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span className="truncate">{d.title || card.title}</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                d.status === 'published' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                d.status === 'completed' ? 'bg-sky-950 text-sky-400 border border-sky-800' :
                'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {d.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Formateur' : 'Instructor'}</span>
                <span className="font-bold text-slate-200">{d.instructorName || 'N/A'}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Lieu' : 'Location'}</span>
                <span className="font-bold text-slate-200 truncate">{d.location || 'N/A'}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Date & Horaires' : 'Schedule'}</span>
                <span className="font-bold text-indigo-300">{d.startDate} ({d.startTime || ''} - {d.endTime || ''})</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Inscrits / Capacité' : 'Enrolled / Capacity'}</span>
                <span className="font-bold text-emerald-400">{d.registeredCount || 0} / {d.capacity || '-'}</span>
              </div>
            </div>
          </div>
        );
      }

      case 'student_incident_summary': {
        const d = card.data || {};
        const openList = d.openIncidents || d.items || [];
        return (
          <div
            key={`${msgId}-student-incident-summary`}
            className="mt-3 bg-slate-900/90 border border-rose-500/30 rounded-xl p-3.5 space-y-3 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-rose-400 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>{card.title || (isFrench ? 'Incidents élèves' : 'Student Incidents')}</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {d.total ?? openList.length} {isFrench ? 'signalements' : 'reports'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'En attente' : 'Pending'}</span>
                <span className="font-bold text-amber-400">{d.submittedCount ?? 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Enquête' : 'Investigating'}</span>
                <span className="font-bold text-sky-400">{d.investigatingCount ?? 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? '1ers soins' : 'First Aid'}</span>
                <span className={`font-bold ${d.firstAidCount > 0 ? 'text-rose-400' : 'text-slate-300'}`}>{d.firstAidCount ?? 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Clôturés' : 'Closed'}</span>
                <span className="font-bold text-emerald-400">{d.closedCount ?? 0}</span>
              </div>
            </div>

            {openList.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  {isFrench ? 'Incidents nécessitant suivi' : 'Incidents Requiring Follow-Up'}
                </span>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {openList.map((inc: any, iIdx: number) => (
                    <div
                      key={iIdx}
                      className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-2 flex items-center justify-between text-xs hover:border-rose-500/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-200 truncate">{inc.studentName}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {inc.incidentDate} · {isFrench ? 'Ligne' : 'Route'} {inc.routeNo}
                        </div>
                      </div>
                      <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-medium bg-rose-950/80 text-rose-300 border border-rose-800/40 shrink-0">
                        {inc.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      }

      case 'student_incident_details': {
        const d = card.data || {};
        return (
          <div
            key={`${msgId}-student-incident-details`}
            className="mt-3 bg-slate-900/90 border border-rose-500/30 rounded-xl p-3.5 space-y-3 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-rose-400 font-semibold text-xs">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span className="truncate">{d.studentName || card.title}</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-rose-950 text-rose-300 border border-rose-800">
                {d.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Élève & Classe' : 'Student & Grade'}</span>
                <span className="font-bold text-slate-200">{d.studentName} {d.grade ? `(${d.grade})` : ''}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Ligne & Chauffeur' : 'Route & Driver'}</span>
                <span className="font-bold text-slate-200 truncate">{d.routeNo} · {d.driverName}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Date & Heure' : 'Date & Time'}</span>
                <span className="font-bold text-rose-300">{d.incidentDate} {d.incidentTime || ''}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Alertes' : 'Flags'}</span>
                <span className="font-bold text-amber-400">
                  {d.firstAidRequired ? '🚑 First Aid ' : ''}
                  {d.studentRemovedFromBus ? '🛑 Removed' : ''}
                  {!d.firstAidRequired && !d.studentRemovedFromBus ? 'Standard' : ''}
                </span>
              </div>
            </div>

            {d.description && (
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300">
                <span className="font-semibold text-slate-400 block text-[10px] uppercase mb-1">
                  {isFrench ? 'Description' : 'Description'}
                </span>
                {d.description}
              </div>
            )}
          </div>
        );
      }

      case 'hazard_report_summary': {
        const d = card.data || {};
        const openList = d.openHazards || d.items || [];
        return (
          <div
            key={`${msgId}-hazard-report-summary`}
            className="mt-3 bg-slate-900/90 border border-orange-500/30 rounded-xl p-3.5 space-y-3 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-orange-400 font-semibold text-xs">
                <AlertOctagon className="w-4 h-4 text-orange-400" />
                <span>{card.title || (isFrench ? 'Rapports de danger' : 'Hazard Reports')}</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {d.total ?? openList.length} {isFrench ? 'rapports' : 'reports'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'En cours' : 'Open'}</span>
                <span className="font-bold text-amber-400">{d.openCount ?? 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Risque Grave' : 'Serious Risk'}</span>
                <span className={`font-bold ${d.seriousCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-300'}`}>{d.seriousCount ?? 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Modéré' : 'Moderate'}</span>
                <span className="font-bold text-orange-400">{d.moderateCount ?? 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Résolus' : 'Resolved'}</span>
                <span className="font-bold text-emerald-400">{d.completedCount ?? 0}</span>
              </div>
            </div>

            {openList.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  {isFrench ? 'Dangers non résolus' : 'Unresolved Hazards'}
                </span>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {openList.map((h: any, hIdx: number) => (
                    <div
                      key={hIdx}
                      className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-2 flex items-center justify-between text-xs hover:border-orange-500/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-200 truncate">{h.eventDescription}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {h.eventTime} · {h.reportedBy}
                        </div>
                      </div>
                      <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 ${
                        h.serious ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                        h.moderate ? 'bg-orange-950 text-orange-300 border border-orange-800' :
                        'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {h.serious ? 'Serious' : h.moderate ? 'Moderate' : 'Minor'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      }

      case 'hazard_report_details': {
        const d = card.data || {};
        return (
          <div
            key={`${msgId}-hazard-report-details`}
            className="mt-3 bg-slate-900/90 border border-orange-500/30 rounded-xl p-3.5 space-y-3 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-orange-400 font-semibold text-xs">
                <AlertOctagon className="w-4 h-4 text-orange-400" />
                <span className="truncate">{d.id || card.title}</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                d.isCompleted ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}>
                {d.isCompleted ? (isFrench ? 'Résolu' : 'Resolved') : (isFrench ? 'Ouvert' : 'Open')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Signalé par' : 'Reported By'}</span>
                <span className="font-bold text-slate-200">{d.reportedBy}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Véhicule / Ligne' : 'Vehicle / Route'}</span>
                <span className="font-bold text-slate-200 truncate">{d.unitNumber || '-'} · {d.routeName || '-'}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Date / Lieu' : 'Date / Location'}</span>
                <span className="font-bold text-orange-300 truncate">{d.eventTime} ({d.eventLocation || '-'})</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Risque' : 'Risk'}</span>
                <span className="font-bold text-amber-400">{d.risk}</span>
              </div>
            </div>

            {d.eventDescription && (
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300">
                <span className="font-semibold text-slate-400 block text-[10px] uppercase mb-1">
                  {isFrench ? 'Description' : 'Description'}
                </span>
                {d.eventDescription}
              </div>
            )}
          </div>
        );
      }

      case 'route_assessment_summary': {
        const d = card.data || {};
        const items = d.items || [];
        return (
          <div
            key={`${msgId}-route-assessment-summary`}
            className="mt-3 bg-slate-900/90 border border-teal-500/30 rounded-xl p-3.5 space-y-3 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-teal-400 font-semibold text-xs">
                <Compass className="w-4 h-4 text-teal-400" />
                <span>{card.title || (isFrench ? 'Évaluations de ligne' : 'Route Assessments')}</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {d.total ?? items.length} {isFrench ? 'évaluations' : 'assessments'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Total' : 'Total'}</span>
                <span className="font-bold text-teal-300">{d.total ?? 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Nouvelles' : 'New Routes'}</span>
                <span className="font-bold text-emerald-400">{d.newRouteCount ?? 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Modifications' : 'Changes'}</span>
                <span className="font-bold text-sky-400">{d.changeRouteCount ?? 0}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Alertes sécurité' : 'Safety Alerts'}</span>
                <span className={`font-bold ${d.flaggedConcernsCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>{d.flaggedConcernsCount ?? 0}</span>
              </div>
            </div>

            {items.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  {isFrench ? 'Évaluations récentes' : 'Recent Assessments'}
                </span>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {items.map((a: any, aIdx: number) => (
                    <div
                      key={aIdx}
                      className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-2 flex items-center justify-between text-xs hover:border-teal-500/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-200 truncate">
                          {isFrench ? 'Ligne' : 'Route'} <span className="text-teal-300 font-bold">{a.routeId}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {a.assessmentDate || 'N/A'} · {a.schoolBoard || 'Standard'}
                        </div>
                      </div>
                      <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-medium bg-teal-950/80 text-teal-300 border border-teal-800/40 shrink-0">
                        {a.assessmentType === '0' ? (isFrench ? 'Nouvelle' : 'New') : (isFrench ? 'Modifiée' : 'Changed')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      }

      case 'route_assessment_details': {
        const d = card.data || {};
        const concerns = d.concerns || [];
        return (
          <div
            key={`${msgId}-route-assessment-details`}
            className="mt-3 bg-slate-900/90 border border-teal-500/30 rounded-xl p-3.5 space-y-3 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-teal-400 font-semibold text-xs">
                <ClipboardCheck className="w-4 h-4 text-teal-400" />
                <span className="truncate">{d.routeId ? `Route ${d.routeId}` : card.title}</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-teal-950 text-teal-300 border border-teal-800">
                {d.assessmentType === '0' ? 'New Route' : 'Route Change'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Commission scolaire' : 'School Board'}</span>
                <span className="font-bold text-slate-200 truncate">{d.schoolBoard || 'N/A'}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Évaluateur' : 'Evaluator'}</span>
                <span className="font-bold text-slate-200">{d.conductedByDriver || 'N/A'}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Date' : 'Assessment Date'}</span>
                <span className="font-bold text-teal-300">{d.assessmentDate || 'N/A'}</span>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">{isFrench ? 'Alertes sécurité' : 'Safety Flags'}</span>
                <span className={`font-bold ${concerns.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {concerns.length} {concerns.length === 1 ? 'concern' : 'concerns'}
                </span>
              </div>
            </div>

            {concerns.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/40 text-xs text-amber-200 space-y-1">
                <span className="font-semibold text-amber-400 block text-[10px] uppercase">
                  {isFrench ? 'Points de vigilance signalés' : 'Flagged Safety Concerns'}
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  {concerns.map((c: string, cIdx: number) => (
                    <li key={cIdx}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {d.summary && (
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300">
                <span className="font-semibold text-slate-400 block text-[10px] uppercase mb-1">
                  {isFrench ? 'Synthèse de l\'évaluateur' : 'Evaluator Summary'}
                </span>
                {d.summary}
              </div>
            )}
          </div>
        );
      }

      case 'action_cancelled': {
        return (
          <div
            key={`${msgId}-cancelled`}
            className="mt-3 bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-xs text-slate-400 flex items-center space-x-2"
          >
            <XCircle className="w-4 h-4 text-slate-500" />
            <span>
              {isFrench
                ? 'Affectation annulée. Aucune modification apportée aux horaires.'
                : 'Assignment cancelled. No changes made to the schedule.'}
            </span>
          </div>
        );
      }

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm pointer-events-auto transition-opacity"
        onClick={onClose}
      />

      <div className={`absolute inset-y-0 right-0 max-w-full flex ${isFullscreen ? 'pl-0 w-full' : 'pl-0 sm:pl-10'} pointer-events-auto`}>
        <div className={`w-screen ${isFullscreen ? 'max-w-full' : 'max-w-full sm:max-w-md'} bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full text-slate-100 animate-in slide-in-from-right duration-300`}>
          {/* Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="font-bold text-sm text-white">
                    {isFrench ? 'Copilote IA de régulation' : 'AI Dispatch Copilot'}
                  </h3>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center space-x-1">
                    <Zap className="w-2.5 h-2.5" />
                    <span>
                      {status?.engine === 'gemini'
                        ? (isFrench ? 'Gemini + Intégré' : 'Gemini + Smart')
                        : (isFrench ? 'Moteur Intelligent' : 'Smart Engine')}
                    </span>
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                      quotaInfo.exhausted
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    }`}
                    title={
                      isFrench
                        ? 'Appels Gemini IA restants aujourd\'hui (les requêtes standard utilisent le moteur gratuit)'
                        : 'Remaining Gemini LLM calls today (standard queries use the free built-in engine)'
                    }
                  >
                    AI: {quotaInfo.remaining}/{quotaInfo.limit}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-1">
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span>{isFrench ? 'Date :' : 'Date:'}</span>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-transparent border-0 text-slate-300 font-mono text-[11px] focus:ring-0 p-0 cursor-pointer underline underline-offset-2 decoration-slate-600"
                    />
                  </div>
                  <span className="text-slate-600">·</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-amber-300 border border-slate-700">
                    <ShieldCheck className="w-2.5 h-2.5 mr-1 text-amber-400" />
                    {ROLE_LABELS[userRole] || userRole}
                  </span>
                  <span className="text-[10px] text-slate-400 hidden sm:inline">
                    {canModifyDispatch
                      ? (isFrench ? '• Modif. Quarts ✓' : '• Shift Edit ✓')
                      : (isFrench ? '• Quarts lecture seule' : '• Shifts Read-Only')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              {/* Voice Readout Toggle */}
              <button
                onClick={() => {
                  const next = !voiceAutoRead;
                  setVoiceAutoRead(next);
                  if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                  }
                }}
                className={`p-1.5 rounded-lg border transition-colors ${
                  voiceAutoRead
                    ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white'
                }`}
                title={isFrench ? 'Lecture vocale des réponses' : 'Toggle voice readout'}
              >
                {voiceAutoRead ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={() => setIsFullscreen((prev) => !prev)}
                className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Mode'}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>

              {/* Language Switcher */}
              <button
                onClick={() => {
                  const nextLang = copilotLang === 'zh' ? 'en' : copilotLang === 'en' ? 'fr' : 'zh';
                  setCopilotLang(nextLang);
                  try {
                    localStorage.setItem('dispatch_ai_lang', nextLang);
                  } catch {}
                  if (messages.length <= 1) {
                    setMessages([]);
                  }
                }}
                className="px-2 py-1 text-[11px] font-bold rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 transition-colors flex items-center space-x-1"
                title="切换语言 / Switch Language"
              >
                <Globe className="w-3 h-3 text-amber-400" />
                <span>{copilotLang === 'zh' ? '🇨🇳 中文' : copilotLang === 'fr' ? '🇫🇷 FR' : '🇺🇸 EN'}</span>
              </button>

              <button
                onClick={() => {
                  setMessages([]);
                  aiService.getStatus().then(setStatus);
                }}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title={isChinese ? '清空对话' : isFrench ? 'Effacer la conversation' : 'Clear conversation'}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title={isChinese ? '关闭' : isFrench ? 'Fermer' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center space-x-1 text-[10px] text-slate-500 mb-1 px-1">
                  {msg.sender === 'assistant' ? (
                    <>
                      <Bot className="w-3 h-3 text-amber-400" />
                      <span>AI Copilot</span>
                    </>
                  ) : (
                    <>
                      <span>{operatorName}</span>
                    </>
                  )}
                  <span>· {msg.timestamp}</span>
                </div>

                <div
                  className={`max-w-[92%] rounded-2xl px-4 py-3 shadow-md ${
                    msg.sender === 'user'
                      ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-none'
                      : 'bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-tl-none'
                  }`}
                >
                  {msg.sender === 'user' ? (
                    <div className="text-sm whitespace-pre-wrap">{msg.text}</div>
                  ) : (
                    renderFormattedText(msg.text)
                  )}

                  {/* Render Action Cards */}
                  {msg.cards?.map((card) => renderActionCard(card, msg.id))}
                </div>

                {/* Suggested Questions */}
                {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 max-w-[92%]">
                    {msg.suggestedQuestions.map((q, qIdx) => (
                      <button
                        key={qIdx}
                        disabled={loading}
                        onClick={() => handleSendMessage(q)}
                        className="text-[11px] bg-slate-800/80 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700/80 hover:border-amber-500/40 rounded-full px-3 py-1 transition-all text-left flex items-center space-x-1"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                        <span>{q}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start space-x-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-none px-4 py-2.5 text-xs text-slate-400 flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce"></span>
                  </div>
                  <span>
                    {isChinese
                      ? '正在分析排班与路线调度数据...'
                      : isFrench
                      ? 'Analyse des quarts et des horaires en cours...'
                      : 'Analyzing dispatch shifts and schedules...'}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-3 py-2 bg-slate-950/40 border-t border-slate-800/80 flex items-center space-x-1.5 overflow-x-auto text-[11px] scrollbar-none">
            <span className="text-slate-500 text-[10px] font-semibold whitespace-nowrap pl-1">
              {isChinese ? '快捷：' : isFrench ? 'Raccourcis :' : 'Quick:'}
            </span>
            <button
              onClick={() =>
                handleSendMessage(
                  isChinese
                    ? '今天有哪些路线缺司机？'
                    : isFrench
                    ? "Quels quarts n'ont pas de chauffeur aujourd'hui ?"
                    : 'Which shifts have no driver today?'
                )
              }
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-md whitespace-nowrap border border-slate-700/60 transition-colors"
            >
              {isChinese ? '缺司机班次' : isFrench ? 'Quarts sans chauffeur' : 'Unassigned Shifts'}
            </button>
            <button
              onClick={() =>
                handleSendMessage(
                  isChinese
                    ? '查看车队车辆状态'
                    : isFrench
                    ? 'Statut de la flotte de véhicules'
                    : 'Vehicle fleet status'
                )
              }
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-md whitespace-nowrap border border-slate-700/60 transition-colors"
            >
              {isChinese ? '车队车辆' : isFrench ? 'Véhicules' : 'Fleet Vehicles'}
            </button>
            <button
              onClick={() =>
                handleSendMessage(
                  isChinese
                    ? '今日校车调度总览'
                    : isFrench
                    ? "Aperçu de la régulation"
                    : "View today's dispatch overview"
                )
              }
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-md whitespace-nowrap border border-slate-700/60 transition-colors"
            >
              {isChinese ? '今日总览' : isFrench ? 'Aperçu global' : 'Overview'}
            </button>
            <button
              onClick={() =>
                handleSendMessage(
                  isChinese
                    ? '请假申请汇总'
                    : isFrench
                    ? "Synthèse des demandes de congé"
                    : "Time off requests overview"
                )
              }
              className="bg-slate-800 hover:bg-slate-700 text-teal-300/90 hover:text-teal-300 px-2.5 py-1 rounded-md whitespace-nowrap border border-teal-500/30 transition-colors"
            >
              {isChinese ? '请假' : isFrench ? 'Congés' : 'Time Off'}
            </button>
            <button
              onClick={() =>
                handleSendMessage(
                  isChinese
                    ? '薪酬与费率汇总'
                    : isFrench
                    ? "Synthèse du module paie & rémunération"
                    : "Payroll and compensation rates summary"
                )
              }
              className="bg-slate-800 hover:bg-slate-700 text-amber-300/90 hover:text-amber-300 px-2.5 py-1 rounded-md whitespace-nowrap border border-amber-500/30 transition-colors"
            >
              {isChinese ? '薪酬' : isFrench ? 'Paie' : 'Payroll'}
            </button>
            <button
              onClick={() =>
                handleSendMessage(
                  isChinese
                    ? '报销申请汇总'
                    : isFrench
                    ? "Synthèse des notes de frais & remboursements"
                    : "Expense reimbursement summary"
                )
              }
              className="bg-slate-800 hover:bg-slate-700 text-emerald-300/90 hover:text-emerald-300 px-2.5 py-1 rounded-md whitespace-nowrap border border-emerald-500/30 transition-colors"
            >
              {isChinese ? '报销' : isFrench ? 'Frais' : 'Expenses'}
            </button>
            <button
              onClick={() =>
                handleSendMessage(
                  isChinese
                    ? '今天是谁创建的调度？'
                    : isFrench
                    ? "Qui a créé le dispatch aujourd'hui ?"
                    : 'Who created dispatch today?'
                )
              }
              className="bg-slate-800 hover:bg-slate-700 text-amber-300/90 hover:text-amber-300 px-2.5 py-1 rounded-md whitespace-nowrap border border-amber-500/30 transition-colors"
            >
              {isChinese ? '调度创建人' : isFrench ? 'Créateur du dispatch' : 'Who created dispatch?'}
            </button>
          </div>

          {/* Input Form */}
          <div className="p-3 border-t border-slate-800 bg-slate-900">
            {isListening && (
              <div className="mb-2 px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[11px] flex items-center justify-between animate-pulse">
                <div className="flex items-center space-x-2">
                  <Mic className="w-3.5 h-3.5 text-rose-400" />
                  <span>
                    {isChinese
                      ? '🎤 正在聆听语音... 请说话（免 Gemini Key · 0 令牌消耗）'
                      : isFrench
                      ? '🎤 Écoute en cours... Parlez maintenant (Gratuit · Sans clé Gemini)'
                      : '🎤 Listening... Speak now (Free Web Speech · 0 Gemini tokens)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className="text-[10px] underline font-semibold text-rose-200"
                >
                  {isChinese ? '停止' : isFrench ? 'Arrêter' : 'Stop'}
                </button>
              </div>
            )}
            {voiceError && (
              <div className="mb-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] flex items-center justify-between">
                <span>{voiceError}</span>
                <button
                  type="button"
                  onClick={() => setVoiceError(null)}
                  className="text-[10px] underline ml-2"
                >
                  ✕
                </button>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center space-x-2"
            >
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={loading}
                className={`p-2.5 rounded-xl font-bold transition-all flex-shrink-0 border ${
                  isListening
                    ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 animate-pulse shadow-md shadow-rose-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700'
                }`}
                title={isChinese ? '语音输入 (麦克风)' : isFrench ? 'Entrée vocale (Microphone)' : 'Voice Input (Microphone)'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    isChinese
                      ? '按 🎤 说话或输入问题（如：今天缺哪些司机、查看路线...）'
                      : isFrench
                      ? "Parlez (🎤) ou posez une question sur les quarts, lignes, véhicules..."
                      : "Tap 🎤 to speak or ask about shifts, routes, vehicles, drivers..."
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 pr-4"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={!inputText.trim() || loading}
                className="p-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-slate-950 font-bold rounded-xl transition-all shadow-md shadow-amber-500/20 flex-shrink-0"
                title={isChinese ? '发送' : isFrench ? 'Envoyer' : 'Send'}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="text-[10px] text-slate-500 text-center mt-2 flex items-center justify-center space-x-2">
              <span>{isChinese ? '快捷键：' : isFrench ? 'Raccourci :' : 'Shortcut:'}</span>
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-400 font-mono">
                Ctrl + J
              </kbd>
              <span>
                {isChinese
                  ? '展开/收起 AI 助手'
                  : isFrench
                  ? 'Ouvrir/fermer le Copilote IA'
                  : 'Toggle AI Copilot'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
