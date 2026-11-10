import { useLanguage } from '../i18n/LanguageContext'
import LanguageToggle from './LanguageToggle'

export default function Footer() {
  const { t } = useLanguage()
  const year = new Date().getFullYear()

  const footerLinks = [
    { href: '#ecosystem', label: t.footer.links.ecosystem },
    { href: '#editions', label: t.footer.links.editions },
    { href: '#highlights', label: t.footer.links.highlights },
    { href: '#demo', label: t.nav.demo },
    { href: '#about', label: t.footer.links.about },
    { href: '#contact', label: t.footer.links.contact },
  ]

  return (
    <footer className="border-t border-white/10 bg-[#070B14] px-6 py-12 text-slate-400">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col items-center justify-between gap-6 md:flex-row md:items-start">
          <div className="text-center md:text-left">
            <div className="flex items-center gap-2.5 justify-center md:justify-start">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-slate-950 font-black text-xl shadow-md shadow-amber-400/20">
                🚌
              </div>
              <div>
                <p className="text-lg font-bold text-white">P&CY Technical</p>
                <p className="text-xs font-mono font-bold uppercase text-amber-300 tracking-wider">
                  Dispatch · Student Transportation OS
                </p>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-400">{t.footer.tagline}</p>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-6 text-xs font-semibold uppercase tracking-wider" aria-label="Footer">
            {footerLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="cursor-pointer text-slate-400 transition-colors duration-200 hover:text-amber-400 focus:outline-none"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row text-xs font-mono text-slate-500">
          <p>
            &copy; {year} {t.footer.copyright}
          </p>

          <div className="flex items-center gap-3">
            <span className="text-slate-400">{t.footer.language}</span>
            <LanguageToggle variant="dark" />
          </div>
        </div>
      </div>
    </footer>
  )
}
