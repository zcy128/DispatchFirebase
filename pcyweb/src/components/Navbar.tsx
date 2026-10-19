import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import LanguageToggle from './LanguageToggle'

const navLinks = [
  { href: '#about', key: 'about' as const },
  { href: '#services', key: 'services' as const },
  { href: '#contact', key: 'contact' as const },
]

export default function Navbar() {
  const { t } = useLanguage()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const handleNavClick = () => setMenuOpen(false)

  const linkClass =
    'cursor-pointer text-sm font-medium text-secondary transition-colors duration-200 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-sm'

  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-4 pt-4 md:px-6">
      <nav
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-5 py-3 transition-all duration-300 ${
          scrolled
            ? 'border border-slate-200/80 bg-white/90 shadow-nav backdrop-blur-md'
            : 'bg-transparent'
        }`}
        aria-label="Main navigation"
      >
        <a
          href="#"
          className={`flex items-center gap-2.5 cursor-pointer text-lg font-bold tracking-tight transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-sm ${
            scrolled ? 'text-primary' : 'text-white'
          }`}
        >
          <img
            src="/pcy_tech_logo.png"
            alt="P&CY Technical Logo"
            className="h-10 w-10 object-contain"
          />
          <span>P&CY Technical</span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.key}
              href={link.href}
              className={`${linkClass} ${scrolled ? '' : '!text-white/85 hover:!text-white'}`}
            >
              {t.nav[link.key]}
            </a>
          ))}

          <LanguageToggle variant={scrolled ? 'light' : 'dark'} />

          <a
            href="#contact"
            className="cursor-pointer rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-accent-light focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {t.nav.cta}
          </a>
        </div>

        <button
          type="button"
          className="flex cursor-pointer flex-col gap-1.5 rounded-md p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span
            className={`block h-0.5 w-6 transition-transform duration-200 ${
              scrolled ? 'bg-primary' : 'bg-white'
            } ${menuOpen ? 'translate-y-2 rotate-45' : ''}`}
          />
          <span
            className={`block h-0.5 w-6 transition-opacity duration-200 ${
              scrolled ? 'bg-primary' : 'bg-white'
            } ${menuOpen ? 'opacity-0' : ''}`}
          />
          <span
            className={`block h-0.5 w-6 transition-transform duration-200 ${
              scrolled ? 'bg-primary' : 'bg-white'
            } ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`}
          />
        </button>
      </nav>

      {menuOpen && (
        <div className="mx-auto mt-2 max-w-6xl rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-nav md:hidden">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.key}
                href={link.href}
                onClick={handleNavClick}
                className={linkClass}
              >
                {t.nav[link.key]}
              </a>
            ))}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <LanguageToggle variant="light" />
              <a
                href="#contact"
                onClick={handleNavClick}
                className="cursor-pointer rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent-light"
              >
                {t.nav.cta}
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
