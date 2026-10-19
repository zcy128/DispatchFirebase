import { useLanguage } from '../i18n/LanguageContext'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { getServiceIcon } from './icons'

export default function Services() {
  const { t } = useLanguage()
  const { ref, visible } = useScrollReveal<HTMLDivElement>()

  return (
    <section id="services" className="bg-surface px-6 py-20 md:py-28">
      <div
        ref={ref}
        className={`reveal mx-auto max-w-6xl ${visible ? 'visible' : ''}`}
      >
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-primary md:text-4xl">
            {t.services.title}
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted">
            {t.services.subtitle}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {t.services.items.map((item, index) => {
            const Icon = getServiceIcon(item.id)
            const isFeatured = index === 0

            return (
              <div
                key={item.id}
                className={`group rounded-2xl border bg-white p-6 shadow-card transition-all duration-200 hover:border-accent/40 hover:shadow-card-hover ${
                  isFeatured
                    ? 'border-accent/30 ring-1 ring-accent/20 sm:col-span-2 lg:col-span-1'
                    : 'border-slate-200'
                }`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="inline-flex rounded-xl bg-accent-pale p-3 text-accent transition-colors duration-200 group-hover:bg-accent group-hover:text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                  {isFeatured && (
                    <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                      {t.services.featured}
                    </span>
                  )}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-primary">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted">
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
