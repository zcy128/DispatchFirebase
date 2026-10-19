import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, X, Smartphone, Share } from 'lucide-react';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, installApp } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (isInstalled || dismissed) {
    return null;
  }

  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
    } else {
      await installApp();
    }
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full bg-slate-900/95 backdrop-blur-md border border-amber-500/30 shadow-2xl shadow-amber-500/10 rounded-2xl p-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-start space-x-3">
          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex-shrink-0 flex items-center justify-center overflow-hidden shadow-inner">
            <img
              src="/icon-192.png"
              alt="Dispatch Hub"
              className="w-10 h-10 object-contain rounded-lg"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-sm text-slate-100">Install Dispatch App</span>
              <span className="px-1.5 py-0.2 text-[9px] bg-amber-500/20 text-amber-400 font-semibold rounded border border-amber-500/30">
                PWA
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Install to your desktop or home screen for faster loading and offline support.
            </p>

            <div className="mt-3 flex items-center space-x-2">
              <button
                onClick={handleInstallClick}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors shadow-sm shadow-amber-500/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isIOS ? 'Install on iOS' : 'Install App'}</span>
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Later
              </button>
            </div>
          </div>

          <button
            onClick={() => setDismissed(true)}
            className="text-slate-500 hover:text-slate-300 transition p-1"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS Safari Instruction Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 text-slate-100 shadow-2xl relative space-y-4">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Install on iPhone / iPad</h3>
                <p className="text-xs text-slate-400">Add DispatchHub to Home Screen</p>
              </div>
            </div>
            <div className="space-y-3 text-xs text-slate-300 pt-2 border-t border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 font-bold flex items-center justify-center text-[10px]">1</span>
                <span>Tap the <Share className="w-3.5 h-3.5 inline mx-1 text-sky-400" /> <strong>Share</strong> button in Safari's bottom toolbar.</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 font-bold flex items-center justify-center text-[10px]">2</span>
                <span>Scroll down and select <strong>"Add to Home Screen"</strong>.</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 font-bold flex items-center justify-center text-[10px]">3</span>
                <span>Tap <strong>Add</strong> at the top right to complete installation.</span>
              </div>
            </div>
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const PWAInstallHeaderButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, installApp } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  // If not installable and not iOS, don't clutter the header
  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
    } else {
      await installApp();
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        title="Install Dispatch Hub App on this device"
        className="hidden md:inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-semibold rounded-lg transition-colors shadow-sm"
      >
        <Download className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
        <span>Install App</span>
      </button>

      {showIOSModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 text-slate-100">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 relative space-y-4">
            <button onClick={() => setShowIOSModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-bold text-slate-100">Add to iPhone / iPad Home Screen</h3>
            <p className="text-xs text-slate-300">
              Tap the Safari <strong>Share</strong> button, then select <strong>"Add to Home Screen"</strong>.
            </p>
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
};
