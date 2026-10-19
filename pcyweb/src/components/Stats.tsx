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
            className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-card transition-shadow duration-200 hover:shadow-card-hover"
          >
            <p className="text-3xl font-bold tracking-tight text-primary md:text-4xl">
              {stat.value}
            </p>
            <p className="mt-1 text-sm font-medium text-muted">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
