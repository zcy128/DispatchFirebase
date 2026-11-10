import { useLanguage } from '../i18n/LanguageContext'
import { useScrollReveal } from '../hooks/useScrollReveal'

export default function Stats() {
  const { t } = useLanguage()
  const { ref, visible } = useScrollReveal<HTMLDivElement>()

  return (
    <section className="relative z-10 -mt-10 px-6 md:-mt-14">
      <div
        ref={ref}
        className={`reveal mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4 ${visible ? 'visible' : ''}`}
      >
        {t.stats.map((stat) => (
          <div
            key={stat.label}
            className="bento-card p-6 text-center shadow-xl transition-all duration-300 hover:scale-[1.02] hover:border-amber-400/40"
          >
            <p className="text-3xl font-extrabold tracking-tight text-amber-400 md:text-4xl font-mono">
              {stat.value}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-300">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
