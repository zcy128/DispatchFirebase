import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import LanguageToggle from './LanguageToggle'
import { SparklesIcon } from './icons'

const navLinks = [
  { href: '#ecosystem', key: 'ecosystem' as const },
  { href: '#editions', key: 'editions' as const },
  { href: '#highlights', key: 'highlights' as const },
  { href: '#demo', key: 'demo' as const },
  { href: '#about', key: 'about' as const },
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

  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-4 pt-3 md:px-6">
      <nav
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-5 py-3 transition-all duration-300 border ${
          scrolled
            ? 'border-white/10 bg-[#0B101D]/90 shadow-2xl backdrop-blur-xl'
            : 'border-white/10 bg-[#0B101D]/70 shadow-lg backdrop-blur-md'
        }`}
        aria-label="Main navigation"
      >
        <a
          href="#"
          className="flex items-center gap-2.5 cursor-pointer text-base md:text-lg font-bold tracking-tight text-white transition-colors duration-200 focus:outline-none"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-slate-950 font-black text-xl shadow-md shadow-amber-400/20">
            🚌
          </div>
          <div className="flex flex-col">
            <span className="leading-tight text-white font-extrabold">P&CY Technical</span>
            <span className="text-[10px] font-semibold tracking-wider uppercase text-amber-300 font-mono">
              Dispatch OS
            </span>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <div className="hidden items-center gap-2 lg:gap-4 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.key}
              href={link.href}
              className="cursor-pointer text-xs font-semibold text-slate-300 transition-colors duration-200 hover:text-amber-300 rounded-md px-2.5 py-1"
            >
              {t.nav[link.key]}
            </a>
          ))}

          <LanguageToggle variant="dark" />

          <a
            href="#demo"
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 shadow-md shadow-amber-400/20 transition-all duration-200 hover:bg-amber-300 hover:scale-105 focus:outline-none"
          >
            <SparklesIcon className="w-3.5 h-3.5 text-slate-950" />
            <span>{t.nav.cta}</span>
          </a>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex items-center gap-2 md:hidden">
          <LanguageToggle variant="dark" />
          <button
            type="button"
            className="flex cursor-pointer flex-col gap-1.5 rounded-md p-1.5 focus:outline-none text-white"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span
              className={`block h-0.5 w-6 rounded-full bg-white transition-transform duration-200 ${
                menuOpen ? 'translate-y-2 rotate-45' : ''
              }`}
            />
            <span
              className={`block h-0.5 w-6 rounded-full bg-white transition-opacity duration-200 ${
                menuOpen ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`block h-0.5 w-6 rounded-full bg-white transition-transform duration-200 ${
                menuOpen ? '-translate-y-2 -rotate-45' : ''
              }`}
            />
          </button>
        </div>
      </nav>

      {/* Mobile Menu Dropdown */}
      {menuOpen && (
        <div className="fixed inset-0 top-[76px] z-40 bg-[#0B101D]/95 backdrop-blur-2xl px-6 py-8 md:hidden flex flex-col justify-between">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.key}
                href={link.href}
                onClick={handleNavClick}
                className="text-lg font-bold text-slate-200 hover:text-amber-400 py-2 border-b border-white/10"
              >
                {t.nav[link.key]}
              </a>
            ))}
          </div>

          <div className="pt-6">
            <a
              href="#demo"
              onClick={handleNavClick}
              className="w-full inline-flex justify-center items-center gap-2 rounded-2xl bg-amber-400 text-slate-950 font-bold py-3.5 shadow-lg shadow-amber-400/20"
            >
              <SparklesIcon className="w-4 h-4 text-slate-950" />
              <span>{t.nav.cta}</span>
            </a>
          </div>
        </div>
      )}
    </header>
  )
}
