import { useLanguage } from '../i18n/LanguageContext'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { MailIcon, MapPinIcon } from './icons'

const EMAIL = 'support@pcytech.ca'
const LOCATION = 'Calgary, AB, Canada'

export default function Contact() {
  const { t } = useLanguage()
  const { ref, visible } = useScrollReveal<HTMLDivElement>()

  return (
    <section id="contact" className="bg-[#0B101D] px-6 py-20 md:py-28 border-t border-white/5 relative">
      <div
        ref={ref}
        className={`reveal mx-auto max-w-4xl ${visible ? 'visible' : ''}`}
      >
        <div className="mb-12 text-center">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400 mb-2 inline-block">
            Partnership & Architecture
          </span>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-white md:text-5xl">
            {t.contact.title}
          </h2>
          <p className="mx-auto max-w-2xl text-base text-slate-300 leading-relaxed md:text-lg">
            {t.contact.subtitle}
          </p>
        </div>

        <div className="mb-10 grid gap-6 sm:grid-cols-2">
          <a
            href={`mailto:${EMAIL}`}
            className="bento-card group p-6 text-center shadow-xl transition-all duration-300 hover:border-amber-400/50 hover:scale-[1.02]"
          >
            <div className="mb-3 inline-flex rounded-xl bg-amber-400/10 border border-amber-400/30 p-3 text-amber-400 transition-colors duration-200 group-hover:bg-amber-400 group-hover:text-slate-950">
              <MailIcon className="h-6 w-6" />
            </div>
            <p className="mb-1 text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
              {t.contact.emailLabel}
            </p>
            <p className="text-base font-bold text-white transition-colors duration-200 group-hover:text-amber-300">
              {EMAIL}
            </p>
          </a>

          <div className="bento-card p-6 text-center shadow-xl">
            <div className="mb-3 inline-flex rounded-xl bg-amber-400/10 border border-amber-400/30 p-3 text-amber-400">
              <MapPinIcon className="h-6 w-6" />
            </div>
            <p className="mb-1 text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
              {t.contact.locationLabel}
            </p>
            <p className="text-base font-bold text-white">{LOCATION}</p>
          </div>
        </div>

        <div className="text-center">
          <a
            href={`mailto:${EMAIL}`}
            className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-amber-400 px-8 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-400/25 transition-all duration-200 hover:bg-amber-300 hover:scale-105 focus:outline-none"
          >
            <MailIcon className="h-5 w-5 text-slate-950" />
            <span>{t.contact.cta}</span>
          </a>
        </div>
      </div>
    </section>
  )
}
