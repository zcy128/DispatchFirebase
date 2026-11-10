import { useLanguage } from '../i18n/LanguageContext'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { CloudIcon, DatabaseIcon, CheckIcon, LayersIcon, ExternalLinkIcon } from './icons'

export default function EditionsSection() {
  const { t } = useLanguage()
  const { ref, visible } = useScrollReveal<HTMLDivElement>()

  return (
    <section id="editions" className="bg-[#0B101D] px-6 py-20 md:py-28 border-t border-white/5 relative">
      <div
        ref={ref}
        className={`reveal mx-auto max-w-6xl ${visible ? 'visible' : ''}`}
      >
        {/* Section Header */}
        <div className="mb-14 text-center">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400 mb-2 inline-block">
            Flexible Deployment Architectures
          </span>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-white md:text-5xl">
            {t.editions.title}
          </h2>
          <p className="mx-auto max-w-2xl text-base text-slate-300 leading-relaxed md:text-lg">
            {t.editions.subtitle}
          </p>
        </div>

        {/* 2-Column Comparison Bento Grid */}
        <div className="grid gap-8 lg:grid-cols-2">
          {t.editions.items.map((edition) => {
            const isCloud = edition.id === 'cloud'

            return (
              <div
                key={edition.id}
                className={`bento-card relative flex flex-col justify-between p-8 shadow-2xl transition-all duration-300 ${
                  edition.recommended
                    ? 'border-amber-400/50 ring-1 ring-amber-400/30'
                    : 'border-white/10'
                }`}
              >
                {edition.recommended && (
                  <div className="absolute -top-3.5 right-8 rounded-full bg-amber-400 px-4 py-1 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-md">
                    High-Scale Enterprise
                  </div>
                )}

                <div>
                  {/* Header Title & Tagline */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-mono font-bold mb-2.5 ${
                          isCloud
                            ? 'bg-sky-400/10 text-sky-300 border border-sky-400/30'
                            : 'bg-amber-400/10 text-amber-300 border border-amber-400/30'
                        }`}
                      >
                        {isCloud ? <CloudIcon className="w-4 h-4" /> : <DatabaseIcon className="w-4 h-4" />}
                        <span>{edition.badge}</span>
                      </span>
                      <h3 className="text-2xl font-extrabold text-white">
                        {edition.name}
                      </h3>
                      <p className="text-xs font-medium text-slate-400 mt-1">
                        {edition.target}
                      </p>
                    </div>

                    <div
                      className={`p-3.5 rounded-2xl ${
                        isCloud ? 'bg-sky-950 text-sky-400 border border-sky-500/20' : 'bg-amber-950 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {isCloud ? <CloudIcon className="w-8 h-8" /> : <DatabaseIcon className="w-8 h-8" />}
                    </div>
                  </div>

                  {/* Architecture Specs Box */}
                  <div className="mb-6 rounded-2xl bg-slate-950/80 p-4 border border-white/10 space-y-2.5 text-xs font-mono">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-white/5">
                      <span className="font-semibold text-slate-400 uppercase tracking-wider">Database:</span>
                      <span className="font-bold text-sky-300 sm:text-right">{edition.database}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-white/5">
                      <span className="font-semibold text-slate-400 uppercase tracking-wider">Backend API:</span>
                      <span className="font-bold text-white sm:text-right">{edition.backend}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-white/5">
                      <span className="font-semibold text-slate-400 uppercase tracking-wider">Real-Time:</span>
                      <span className="font-bold text-emerald-400 sm:text-right">{edition.realtime}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                      <span className="font-semibold text-slate-400 uppercase tracking-wider">Hosting:</span>
                      <span className="font-bold text-slate-200 sm:text-right">{edition.hosting}</span>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <div className="space-y-3 mb-8">
                    {edition.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                        <div
                          className={`rounded-full p-0.5 mt-0.5 shrink-0 ${
                            isCloud
                              ? 'bg-sky-400/20 text-sky-400'
                              : 'bg-amber-400/20 text-amber-400'
                          }`}
                        >
                          <CheckIcon className="w-3.5 h-3.5" />
                        </div>
                        <span className="leading-snug">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-4 border-t border-white/10 space-y-2.5">
                  <a
                    href={edition.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full inline-flex justify-center items-center gap-2 rounded-2xl py-3 text-xs sm:text-sm font-bold transition-all duration-200 focus:outline-none ${
                      isCloud
                        ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20 hover:bg-sky-400'
                        : 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/25 hover:bg-amber-300'
                    }`}
                  >
                    <span>{edition.demoLabel}</span>
                    <ExternalLinkIcon className="w-4 h-4" />
                  </a>

                  <a
                    href="#contact"
                    className="w-full inline-flex justify-center items-center gap-1.5 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                  >
                    <LayersIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Inquire About {edition.name}</span>
                  </a>
                </div>
              </div>
            )
          })}
        </div>

        {/* Reassurance Banner */}
        <div className="mt-8 rounded-2xl bg-slate-900/60 p-4 border border-white/10 text-center text-xs text-slate-300 backdrop-blur-md">
          💡 {t.editions.summaryNote}
        </div>
      </div>
    </section>
  )
}
