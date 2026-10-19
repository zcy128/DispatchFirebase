import { useLanguage } from '../i18n/LanguageContext'

interface LanguageToggleProps {
  variant?: 'light' | 'dark'
}

export default function LanguageToggle({ variant = 'light' }: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage()

  const activeClass =
    variant === 'light'
      ? 'bg-primary text-white shadow-sm'
      : 'bg-white text-primary shadow-sm'

  const inactiveClass =
    variant === 'light'
      ? 'text-muted hover:text-primary'
      : 'text-white/70 hover:text-white'

  const containerClass =
    variant === 'light'
      ? 'border-slate-200 bg-surface'
      : 'border-white/20 bg-white/10'

  return (
    <div
      className={`flex items-center gap-1 rounded-full border p-1 ${containerClass}`}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
          language === 'en' ? activeClass : inactiveClass
        }`}
        aria-pressed={language === 'en'}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage('zh')}
        className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
          language === 'zh' ? activeClass : inactiveClass
        }`}
        aria-pressed={language === 'zh'}
      >
        中文
      </button>
    </div>
  )
}
