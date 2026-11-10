import { useLanguage } from '../i18n/LanguageContext'
import { SparklesIcon, LayersIcon, ArrowRightIcon } from './icons'

export default function Hero() {
  const { t } = useLanguage()

  return (
    <section className="relative overflow-hidden bg-[#0B101D] px-6 pb-20 pt-32 md:pb-28 md:pt-40">
      {/* Background ambient lighting */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
        aria-hidden="true"
      />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[650px] h-[650px] bg-amber-400/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative mx-auto max-w-5xl text-center">
        {/* Industry Badge */}
        <div className="mb-6 inline-flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-amber-300 backdrop-blur-md">
            <SparklesIcon className="w-3.5 h-3.5 text-amber-300" />
            <span>{t.hero.badge}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-wide text-slate-300 backdrop-blur-md">
            <LayersIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.hero.editionsPill}</span>
          </span>
        </div>

        {/* Main Headline */}
        <h1 className="mb-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-6xl">
          {t.hero.title}
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mb-10 max-w-3xl text-base leading-relaxed text-slate-300 md:text-lg">
          {t.hero.subtitle}
        </p>

        {/* Dual CTAs */}
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row mb-16">
          <a
            href="#demo"
            className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-amber-400 px-8 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-400/25 transition-all duration-200 hover:bg-amber-300 hover:scale-105 focus:outline-none"
          >
            <span>{t.hero.cta}</span>
            <ArrowRightIcon className="w-4 h-4 text-slate-950" />
          </a>
          <a
            href="#editions"
            className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-8 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:outline-none"
          >
            <LayersIcon className="w-4 h-4 text-amber-300" />
            <span>{t.hero.secondaryCta}</span>
          </a>
        </div>

        {/* Direction 3 Bento Preview Card in Hero */}
        <div className="relative mx-auto max-w-4xl rounded-[28px] border border-white/15 bg-slate-900/80 p-3 sm:p-5 shadow-2xl backdrop-blur-xl">
          {/* Window Header Bar */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-xs font-mono text-slate-400 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="ml-2 font-bold text-slate-300">DISPATCH_OS_LIVE_HUD</span>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                GPS STREAM ACTIVE
              </span>
              <span className="text-amber-300 font-semibold">SUB-SECOND SYNC</span>
            </div>
          </div>

          {/* Bento Split Preview */}
          <div className="grid sm:grid-cols-12 gap-4 items-center">
            {/* Mockup Screenshot */}
            <div className="sm:col-span-7 rounded-2xl overflow-hidden border border-white/10 bg-slate-950">
              <img
                src="/bus_dashboard_mockup.png"
                alt="Dispatch Console Dashboard"
                className="w-full h-auto object-cover max-h-[360px]"
                loading="eager"
              />
            </div>

            {/* Bento Live Stats & Arrival Card */}
            <div className="sm:col-span-5 flex flex-col justify-between space-y-3 text-left">
              <div className="rounded-2xl bg-slate-950/90 border border-white/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono text-amber-300 uppercase font-bold tracking-wider">Family Bento Tracker</div>
                    <div className="text-xl font-extrabold text-white mt-0.5">&lt; 2 MINS AWAY</div>
                  </div>
                  <span className="text-2xl">🚌</span>
                </div>

                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full w-[85%] rounded-full" />
                </div>

                <div className="text-[11px] font-mono text-slate-300 flex justify-between">
                  <span>Stop: Elm Street #4</span>
                  <span className="text-emerald-400 font-bold">Liam Davis (Boarded ✓)</span>
                </div>
              </div>

              {/* Driver Punch Indicator */}
              <div className="rounded-2xl bg-slate-950/90 border border-white/10 p-3.5 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">📱</span>
                  <div>
                    <div className="text-white font-bold">Driver Shift Check-In</div>
                    <div className="text-slate-400 text-[11px]">GPS Verified · 07:15 AM</div>
                  </div>
                </div>
                <span className="text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-[10px]">
                  ON TIME
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
