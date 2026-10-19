import React, { useState, useEffect } from 'react';
import { X, Bell, Mail, MessageSquare, Check, RotateCcw, ShieldCheck } from 'lucide-react';
import { TimeOffNotificationSettings, DEFAULT_TIMEOFF_NOTIFICATION_SETTINGS } from '../../types/timeOff';
import { TimeOffService } from '../../services/timeOffService';

interface TimeOffSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: (settings: TimeOffNotificationSettings) => void;
}

export const TimeOffSettingsModal: React.FC<TimeOffSettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved
}) => {
  const [settings, setSettings] = useState<TimeOffNotificationSettings>(
    DEFAULT_TIMEOFF_NOTIFICATION_SETTINGS
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setSavedSuccess(false);
      TimeOffService.getNotificationSettings()
        .then((s) => {
          setSettings(s);
          setLoading(false);
        })
        .catch(() => {
          setSettings(DEFAULT_TIMEOFF_NOTIFICATION_SETTINGS);
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await TimeOffService.saveNotificationSettings(settings);
      setSavedSuccess(true);
      if (onSettingsSaved) {
        onSettingsSaved(settings);
      }
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (e) {
      console.error('Failed to save settings:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_TIMEOFF_NOTIFICATION_SETTINGS);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Time Off Notifications Configuration
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Automated applicant delivery alerts on decision
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 flex items-start space-x-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>
              Configure default channels used when HR approves or rejects a leave request.
              Reviewers can also toggle channels on/off on a per-decision basis.
            </span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Loading configuration...
            </div>
          ) : (
            <div className="space-y-4">
              {/* Approval Notifications */}
              <div className="bg-slate-800/20 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  <Check className="w-4 h-4" />
                  <span>On Request Approved</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center space-x-2.5 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition">
                    <input
                      type="checkbox"
                      checked={settings.notifyOnApprovalEmail}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          notifyOnApprovalEmail: e.target.checked
                        }))
                      }
                      className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-900 w-4 h-4"
                    />
                    <Mail className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-slate-200 font-medium">Send Email</span>
                  </label>

                  <label className="flex items-center space-x-2.5 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition">
                    <input
                      type="checkbox"
                      checked={settings.notifyOnApprovalSms}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          notifyOnApprovalSms: e.target.checked
                        }))
                      }
                      className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-900 w-4 h-4"
                    />
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-slate-200 font-medium">Send SMS</span>
                  </label>
                </div>
              </div>

              {/* Rejection Notifications */}
              <div className="bg-slate-800/20 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-rose-400">
                  <X className="w-4 h-4" />
                  <span>On Request Rejected</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center space-x-2.5 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition">
                    <input
                      type="checkbox"
                      checked={settings.notifyOnRejectionEmail}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          notifyOnRejectionEmail: e.target.checked
                        }))
                      }
                      className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-900 w-4 h-4"
                    />
                    <Mail className="w-4 h-4 text-rose-400" />
                    <span className="text-xs text-slate-200 font-medium">Send Email</span>
                  </label>

                  <label className="flex items-center space-x-2.5 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition">
                    <input
                      type="checkbox"
                      checked={settings.notifyOnRejectionSms}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          notifyOnRejectionSms: e.target.checked
                        }))
                      }
                      className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-900 w-4 h-4"
                    />
                    <MessageSquare className="w-4 h-4 text-rose-400" />
                    <span className="text-xs text-slate-200 font-medium">Send SMS</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving || loading}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Configuration</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
