import { useLanguage } from '../i18n/LanguageContext'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { ZapIcon } from './icons'

export default function HighlightsSection() {
  const { t } = useLanguage()
  const { ref, visible } = useScrollReveal<HTMLDivElement>()

  return (
    <section id="highlights" className="bg-[#0B101D] px-6 py-20 md:py-28 border-t border-white/5 relative">
      <div
        ref={ref}
        className={`reveal mx-auto max-w-6xl ${visible ? 'visible' : ''}`}
      >
        <div className="mb-14 text-center">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400 mb-2 inline-block">
            Engineering & Operations Safety
          </span>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-white md:text-5xl">
            {t.highlights.title}
          </h2>
          <p className="mx-auto max-w-2xl text-base text-slate-300 leading-relaxed md:text-lg">
            {t.highlights.subtitle}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {t.highlights.items.map((item, index) => {
            const isFullSpan = index === t.highlights.items.length - 1

            return (
              <div
                key={item.number}
                className={`bento-card group p-7 shadow-xl transition-all duration-300 hover:border-amber-400/50 ${
                  isFullSpan ? 'md:col-span-2 lg:col-span-1' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 border border-amber-400/30 font-mono text-sm font-extrabold text-amber-400 group-hover:bg-amber-400 group-hover:text-slate-950 transition-colors duration-200">
                    {item.number}
                  </span>
                  <ZapIcon className="w-5 h-5 text-slate-500 group-hover:text-amber-400 transition-colors" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-300">
                  {item.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
