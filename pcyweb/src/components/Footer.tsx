import { useLanguage } from '../i18n/LanguageContext'
import LanguageToggle from './LanguageToggle'

export default function Footer() {
  const { t } = useLanguage()
  const year = new Date().getFullYear()

  const footerLinks = [
    { href: '#about', label: t.footer.links.about },
    { href: '#services', label: t.footer.links.services },
    { href: '#contact', label: t.footer.links.contact },
  ]

  return (
    <footer className="border-t border-slate-200 bg-white px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col items-center justify-between gap-6 md:flex-row md:items-start">
          <div className="text-center md:text-left">
            <div className="flex items-center gap-2.5 justify-center md:justify-start">
              <img
                src="/pcy_tech_logo.png"
                alt="P&CY Technical Logo"
                className="h-10 w-10 object-contain"
              />
              <p className="text-lg font-bold text-primary">P&CY Technical</p>
            </div>
            <p className="mt-2 text-sm text-muted">{t.footer.tagline}</p>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-6" aria-label="Footer">
            {footerLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="cursor-pointer text-sm font-medium text-muted transition-colors duration-200 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-sm"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-6 sm:flex-row">
          <p className="text-sm text-muted">
            &copy; {year} {t.footer.copyright}
          </p>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">{t.footer.language}</span>
            <LanguageToggle variant="light" />
          </div>
        </div>
      </div>
    </footer>
  )
}
