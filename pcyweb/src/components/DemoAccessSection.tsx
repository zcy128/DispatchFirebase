import { useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { ExternalLinkIcon, SparklesIcon, CloudIcon, DatabaseIcon } from './icons'

export default function DemoAccessSection() {
  const { t } = useLanguage()
  const { ref, visible } = useScrollReveal<HTMLDivElement>()
  const [activeTab, setActiveTab] = useState<'cloud' | 'enterprise'>('cloud')

  const currentTab =
    activeTab === 'cloud'
      ? t.demoAccess.cloudTab
      : t.demoAccess.enterpriseTab

  return (
    <section id="demo" className="bg-[#0B101D] px-6 py-20 md:py-28 text-white relative overflow-hidden border-t border-white/5">
      {/* Background ambient lighting */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-amber-400/10 rounded-full blur-[140px] pointer-events-none"
        aria-hidden="true"
      />

      <div
        ref={ref}
        className={`reveal relative mx-auto max-w-6xl ${visible ? 'visible' : ''}`}
      >
        {/* Section Header */}
        <div className="mb-10 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs font-mono font-bold text-amber-300 mb-3 backdrop-blur-md">
            <SparklesIcon className="w-3.5 h-3.5 text-amber-300" />
            <span>Interactive Live Demo Sandboxes</span>
          </span>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-white md:text-5xl">
            {t.demoAccess.title}
          </h2>
          <p className="mx-auto max-w-2xl text-base text-slate-300 leading-relaxed md:text-lg">
            {t.demoAccess.subtitle}
          </p>
        </div>

        {/* Edition Switcher Tabs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
          <button
            type="button"
            onClick={() => setActiveTab('cloud')}
            className={`cursor-pointer inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-200 backdrop-blur-md border ${
              activeTab === 'cloud'
                ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-lg shadow-amber-400/20 scale-105'
                : 'bg-slate-900/70 text-slate-300 border-white/10 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <CloudIcon className="w-4 h-4 text-sky-400" />
            <span>{t.demoAccess.cloudTab.tabLabel}</span>
            <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider font-semibold">
              Serverless
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('enterprise')}
            className={`cursor-pointer inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-200 backdrop-blur-md border ${
              activeTab === 'enterprise'
                ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-lg shadow-amber-400/20 scale-105'
                : 'bg-slate-900/70 text-slate-300 border-white/10 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <DatabaseIcon className="w-4 h-4 text-amber-400" />
            <span>{t.demoAccess.enterpriseTab.tabLabel}</span>
            <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider font-semibold">
              .NET / SQL
            </span>
          </button>
        </div>

        {/* Tab Intro Banner */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:p-5 mb-8 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{currentTab.name}</span>
              <span className="rounded-lg bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-amber-300 border border-amber-400/30">
                {currentTab.badge}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{currentTab.tagline}</p>
          </div>
          <span className="text-xs text-amber-300 font-semibold shrink-0">
            ✓ Zero Setup Required · Instant 1-Click Access
          </span>
        </div>

        {/* 4 Cards Bento Grid for the selected Edition */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {currentTab.accounts.map((acc) => (
            <div
              key={acc.app}
              className="bento-card flex flex-col justify-between p-6 shadow-xl transition-all duration-300 hover:border-amber-400/50 hover:scale-[1.02]"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/30">
                    {acc.tech}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mb-2 leading-snug">
                  {acc.app}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  {acc.roleScope}
                </p>

                {/* Account Details / Instruction Box */}
                <div className="rounded-2xl bg-slate-950/90 p-3.5 border border-white/10 space-y-2 text-xs mb-4">
                  {activeTab !== 'enterprise' && acc.username && acc.username !== '—' && (
                    <div className="flex justify-between items-center text-slate-400 font-mono text-[11px]">
                      <span>User:</span>
                      <span className="font-bold text-amber-300">{acc.username}</span>
                    </div>
                  )}
                  {activeTab !== 'enterprise' && acc.password && acc.password !== '—' && (
                    <div className="flex justify-between items-center text-slate-400 font-mono text-[11px]">
                      <span>Auth:</span>
                      <span className="text-emerald-400 font-bold">{acc.password}</span>
                    </div>
                  )}
                  <div className={`text-[11px] text-amber-200 font-medium leading-snug ${
                    activeTab !== 'enterprise' && (acc.username || acc.password) ? 'pt-1 border-t border-white/5' : ''
                  }`}>
                    👉 {acc.instructions}
                  </div>
                </div>
              </div>

              <div className="space-y-2 mt-2">
                {acc.url.startsWith('http') && (
                  <a
                    href={acc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center justify-center gap-1.5 w-full rounded-xl px-4 py-2.5 text-xs font-bold text-slate-950 transition-all duration-200 shadow-sm ${
                      activeTab === 'cloud'
                        ? 'bg-sky-400 hover:bg-sky-300'
                        : 'bg-amber-400 hover:bg-amber-300'
                    }`}
                  >
                    <span>Launch Live Demo</span>
                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                  </a>
                )}

                {acc.mirrorUrl && (
                  <a
                    href={acc.mirrorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1 w-full text-[11px] text-slate-400 hover:text-sky-300 py-1 transition-colors font-mono"
                  >
                    <span>Mirror: {acc.mirrorUrl.replace('https://', '')}</span>
                    <ExternalLinkIcon className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Contextual Architecture Tip Callout */}
        <div className="rounded-2xl border border-white/15 bg-white/5 p-4 md:p-5 backdrop-blur-md flex items-start gap-3.5 text-xs md:text-sm text-slate-300">
          <span className="text-xl shrink-0">🚌</span>
          <p className="leading-relaxed">
            {currentTab.tip}
          </p>
        </div>
      </div>
    </section>
  )
}
