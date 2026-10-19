import { useLanguage } from '../i18n/LanguageContext'

export default function Hero() {
  const { t } = useLanguage()

  return (
    <section className="relative overflow-hidden bg-primary px-6 pb-20 pt-32 md:pb-28 md:pt-44">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-transparent to-transparent" aria-hidden="true" />
      <div className="absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-accent-light/10 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-5xl text-center">
        <span className="mb-6 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-white/90 backdrop-blur-sm">
          {t.hero.badge}
        </span>

        <h1 className="mb-6 text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-6xl">
          {t.hero.title}
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-white/75 md:text-xl">
          {t.hero.subtitle}
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#contact"
            className="inline-flex cursor-pointer items-center rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/30 transition-colors duration-200 hover:bg-accent-light focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
          >
            {t.hero.cta}
          </a>
          <a
            href="#services"
            className="inline-flex cursor-pointer items-center rounded-full border border-white/25 bg-white/10 px-8 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors duration-200 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
          >
            {t.hero.secondaryCta}
          </a>
        </div>

        <div className="mt-14 md:mt-20 relative mx-auto max-w-4xl rounded-2xl border border-white/10 bg-slate-900/50 p-2.5 shadow-[0_20px_50px_rgba(3,105,161,0.3)] backdrop-blur-sm transition-all duration-300 hover:scale-[1.01] hover:-translate-y-1">
          <img
            src="/bus_dashboard_mockup.png"
            alt="P&CY Technical School Bus Scheduling Dashboard Mockup"
            className="rounded-xl w-full h-auto object-cover border border-white/5"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  )
}
