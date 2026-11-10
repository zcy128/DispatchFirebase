import { useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { MonitorIcon, SmartphoneIcon, UsersIcon, CheckIcon, ExternalLinkIcon, CloudIcon, DatabaseIcon } from './icons'

export default function EcosystemShowcase() {
  const { t } = useLanguage()
  const { ref, visible } = useScrollReveal<HTMLDivElement>()
  const [activeAppIndex, setActiveAppIndex] = useState(0)

  const activeApp = t.ecosystem.apps[activeAppIndex]

  const getAppIcon = (id: string) => {
    switch (id) {
      case 'dispatch':
        return <MonitorIcon className="w-5 h-5" />
      case 'driver':
        return <SmartphoneIcon className="w-5 h-5" />
      case 'parent':
        return <UsersIcon className="w-5 h-5" />
      default:
        return <MonitorIcon className="w-5 h-5" />
    }
  }

  return (
    <section id="ecosystem" className="bg-[#0B101D] px-6 py-20 md:py-28 border-t border-white/5 relative">
      <div
        ref={ref}
        className={`reveal mx-auto max-w-6xl ${visible ? 'visible' : ''}`}
      >
        {/* Section Header */}
        <div className="mb-14 text-center">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400 mb-2 inline-block">
            Tri-Party Unified Operations
          </span>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-white md:text-5xl">
            {t.ecosystem.title}
          </h2>
          <p className="mx-auto max-w-2xl text-base text-slate-300 leading-relaxed md:text-lg">
            {t.ecosystem.subtitle}
          </p>
        </div>

        {/* Horizontal App Navigation Switcher */}
        <div className="flex flex-wrap justify-center gap-3 mb-10 border-b border-white/10 pb-6">
          {t.ecosystem.apps.map((app, index) => {
            const isActive = index === activeAppIndex
            return (
              <button
                key={app.id}
                type="button"
                onClick={() => setActiveAppIndex(index)}
                className={`inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl text-sm font-bold tracking-wide border transition-all duration-200 focus:outline-none cursor-pointer ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-lg shadow-amber-400/20 scale-[1.03]'
                    : 'bg-slate-900/70 text-slate-300 border-white/10 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <span className={isActive ? 'text-slate-950' : 'text-amber-400'}>
                  {getAppIcon(app.id)}
                </span>
                <span>{app.title}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ${
                    isActive
                      ? 'bg-black/20 text-slate-950'
                      : 'bg-white/10 text-slate-400'
                  }`}
                >
                  {app.badge}
                </span>
              </button>
            )
          })}
        </div>

        {/* Detailed Application Bento Card */}
        <div className="bento-card p-6 md:p-10 shadow-2xl relative overflow-hidden">
          <div className="grid gap-10 lg:grid-cols-12 items-center">
            {/* Left Column: Feature Narrative */}
            <div className="lg:col-span-6 flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-xl bg-amber-400/10 border border-amber-400/30 px-3.5 py-1 text-xs font-mono font-bold text-amber-300 mb-4">
                  {getAppIcon(activeApp.id)}
                  <span>{activeApp.role}</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-extrabold text-white mb-3">
                  {activeApp.title}
                </h3>
                <p className="text-sm md:text-base leading-relaxed text-slate-300 mb-6">
                  {activeApp.description}
                </p>

                {/* Feature Checklist */}
                <div className="space-y-2.5 mb-8">
                  {activeApp.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs md:text-sm text-slate-200">
                      <div className="rounded-full bg-amber-400/20 text-amber-400 p-0.5 mt-0.5 shrink-0 border border-amber-400/30">
                        <CheckIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="leading-snug">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dual Edition Demo Launch Bar */}
              <div className="pt-6 border-t border-white/10 space-y-3">
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Instant Access (Both Architectures Supported):
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {/* Cloud Edition (Firebase) Action */}
                  <div className="rounded-2xl border border-sky-400/30 bg-slate-950/70 p-3.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300 mb-1">
                        <CloudIcon className="w-3.5 h-3.5 text-sky-400" />
                        <span>Cloud Edition (Firebase)</span>
                      </div>
                      <div className="text-[11px] text-slate-300 leading-snug mb-3 font-medium">
                        {activeApp.cloudAuth}
                      </div>
                    </div>
                    <a
                      href={activeApp.cloudDemoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-500 px-3 py-2 text-xs font-bold text-slate-950 transition-all duration-200 hover:bg-sky-400 shadow-sm"
                    >
                      <span>Launch Cloud Demo</span>
                      <ExternalLinkIcon className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* Enterprise Edition (.NET/SQL) Action */}
                  <div className="rounded-2xl border border-amber-400/30 bg-slate-950/70 p-3.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 mb-1">
                        <DatabaseIcon className="w-3.5 h-3.5 text-amber-400" />
                        <span>Enterprise (.NET / SQL)</span>
                      </div>
                      <div className="text-[11px] text-slate-300 leading-snug mb-3 font-mono text-[10.5px]">
                        {activeApp.enterpriseAuth}
                      </div>
                    </div>
                    <a
                      href={activeApp.enterpriseDemoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 transition-all duration-200 hover:bg-amber-300 shadow-sm"
                    >
                      <span>Launch Enterprise</span>
                      <ExternalLinkIcon className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Visual Preview */}
            <div className="lg:col-span-6 relative flex items-center justify-center">
              <div className="absolute -inset-4 bg-amber-400/10 rounded-full blur-3xl opacity-40" aria-hidden="true" />
              <div className="relative w-full rounded-2xl overflow-hidden border border-white/15 bg-slate-950 shadow-2xl transition-all duration-300 hover:scale-[1.01]">
                <div className="bg-slate-950 px-4 py-2.5 flex items-center justify-between text-white text-[11px] font-mono border-b border-white/10">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="ml-2 text-slate-400 truncate">
                      {activeApp.cloudDemoUrl.replace('https://', '')}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-amber-300">{activeApp.badge}</span>
                </div>
                <img
                  src={activeApp.image}
                  alt={activeApp.title}
                  className="w-full h-auto object-cover max-h-[440px]"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
