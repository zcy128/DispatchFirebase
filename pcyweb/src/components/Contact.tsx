import { useLanguage } from '../i18n/LanguageContext'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { MailIcon, MapPinIcon } from './icons'

const EMAIL = 'support@pcytech.ca'
const LOCATION = 'Calgary, AB, Canada'

export default function Contact() {
  const { t } = useLanguage()
  const { ref, visible } = useScrollReveal<HTMLDivElement>()

  return (
    <section id="contact" className="bg-primary px-6 py-20 md:py-28">
      <div
        ref={ref}
        className={`reveal mx-auto max-w-4xl ${visible ? 'visible' : ''}`}
      >
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
            {t.contact.title}
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-white/70">
            {t.contact.subtitle}
          </p>
        </div>

        <div className="mb-10 grid gap-6 sm:grid-cols-2">
          <a
            href={`mailto:${EMAIL}`}
            className="group cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm transition-colors duration-200 hover:border-accent/40 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-light focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
          >
            <div className="mb-3 inline-flex rounded-xl bg-accent/20 p-3 text-accent-light transition-colors duration-200 group-hover:bg-accent/30">
              <MailIcon className="h-6 w-6" />
            </div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-white/50">
              {t.contact.emailLabel}
            </p>
            <p className="text-lg font-semibold text-white transition-colors duration-200 group-hover:text-accent-light">
              {EMAIL}
            </p>
          </a>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm">
            <div className="mb-3 inline-flex rounded-xl bg-accent/20 p-3 text-accent-light">
              <MapPinIcon className="h-6 w-6" />
            </div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-white/50">
              {t.contact.locationLabel}
            </p>
            <p className="text-lg font-semibold text-white">{LOCATION}</p>
          </div>
        </div>

        <div className="text-center">
          <a
            href={`mailto:${EMAIL}`}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/30 transition-colors duration-200 hover:bg-accent-light focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
          >
            <MailIcon className="h-5 w-5" />
            {t.contact.cta}
          </a>
        </div>
      </div>
    </section>
  )
}
