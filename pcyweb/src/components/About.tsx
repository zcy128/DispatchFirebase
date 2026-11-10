import { useState, type ReactNode } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { useScrollReveal } from '../hooks/useScrollReveal'

const slideIcons: Record<string, { image: string; icon: ReactNode }> = {
  checkin: {
    image: '/driver_shift_checkin.png',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  pickup: {
    image: '/driver_student_pickup.png',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  timeoff: {
    image: '/driver_time_off.png',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  expense: {
    image: '/driver_expense_reimburse.png',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h12a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0013 2H9zM11 9.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm-3 6.5a1 1 0 110-2h8a1 1 0 110 2H8z" />
      </svg>
    ),
  },
  defect: {
    image: '/driver_vehicle_defect.png',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
}

export default function About() {
  const { t } = useLanguage()
  const { ref, visible } = useScrollReveal<HTMLDivElement>()
  const [activeSlide, setActiveSlide] = useState(0)

  const infoCards = [
    { label: t.about.locationLabel, value: t.about.location },
    { label: t.about.foundedLabel, value: t.about.founded },
    { label: t.about.focusLabel, value: t.about.focus },
  ]

  const slides = t.about.driverSlides
  const currentSlide = slides[activeSlide] || slides[0]
  const currentMeta = slideIcons[currentSlide.id] || slideIcons.checkin

  return (
    <section id="about" className="bg-[#0B101D] px-6 py-20 md:py-28 border-t border-white/5 relative">
      <div
        ref={ref}
        className={`reveal mx-auto max-w-5xl ${visible ? 'visible' : ''}`}
      >
        {/* Section 1: Company Profile */}
        <div className="mb-16">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-white md:text-5xl">
              {t.about.title}
            </h2>
            <p className="text-base sm:text-lg leading-relaxed text-slate-300">
              {t.about.description}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {infoCards.map((card) => (
              <div
                key={card.label}
                className="bento-card p-6 text-center shadow-xl transition-all duration-300 hover:scale-[1.02]"
              >
                <div className="mb-1 text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                  {card.label}
                </div>
                <div className="text-base font-extrabold text-white">
                  {card.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Driver App Interactive Showcase */}
        <div className="mb-16">
          <div className="max-w-3xl mx-auto text-center mb-8">
            <h3 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl mb-3">
              {t.about.showcaseTitle}
            </h3>
            <p className="text-sm md:text-base text-slate-300">
              {t.about.showcaseSubtitle}
            </p>
          </div>

          {/* Slide Navigation Buttons */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {slides.map((slide, index) => {
              const meta = slideIcons[slide.id] || slideIcons.checkin
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setActiveSlide(index)}
                  className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border ${
                    activeSlide === index
                      ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-400/20 scale-105'
                      : 'bg-slate-900/70 text-slate-300 border-white/10 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  {meta.icon}
                  <span>{slide.title}</span>
                </button>
              )
            })}
          </div>

          {/* Interactive Driver Mockup & Details Display */}
          <div className="grid lg:grid-cols-12 gap-8 items-center bento-card p-6 sm:p-10 shadow-2xl">
            {/* Left: Device Frame Mockup */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative mx-auto border-gray-900 bg-gray-900 border-[10px] rounded-[2.5rem] h-[480px] w-[240px] sm:h-[520px] sm:w-[260px] shadow-2xl overflow-hidden ring-1 ring-white/10">
                {/* Speaker Grill */}
                <div className="w-[80px] h-[4px] bg-gray-700 top-2 rounded-full absolute left-1/2 -translate-x-1/2 z-20" />
                {/* Camera Dot */}
                <div className="w-2.5 h-2.5 bg-gray-700 rounded-full absolute top-1.5 right-12 z-20" />

                {/* Screen Content */}
                <div className="h-full w-full bg-slate-950 overflow-hidden relative">
                  <img
                    key={currentSlide.id}
                    src={currentMeta.image}
                    alt={currentSlide.title}
                    className="w-full h-full object-cover object-top transition-opacity duration-300"
                  />
                  {/* Bottom Home Indicator */}
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-1 bg-white/40 rounded-full pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Right: Functional Breakdown & Capabilities */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
                  {currentMeta.icon}
                </div>
                <h4 className="text-xl font-bold text-white md:text-2xl">
                  {currentSlide.title}
                </h4>
              </div>

              <p className="text-base leading-relaxed text-slate-300 mb-6">
                {currentSlide.details}
              </p>

              {/* Key Capabilities */}
              <div className="mb-6">
                <h5 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300 mb-3">
                  {t.about.keyCapabilities}
                </h5>
                <ul className="space-y-2.5">
                  {currentSlide.bullets.map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-200">
                      <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Highlight Tip Box */}
              <div className="p-4 rounded-2xl border border-white/10 bg-slate-950/70 flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs leading-relaxed text-amber-200/90 font-medium font-mono">
                  {currentSlide.tip}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Core Values */}
        <div>
          <h3 className="mb-8 text-center text-2xl font-bold text-white">
            {t.about.valuesTitle}
          </h3>
          <div className="grid gap-6 md:grid-cols-3">
            {t.about.values.map((value, index) => (
              <div
                key={value.title}
                className="bento-card p-6 shadow-xl transition-all duration-300 hover:border-amber-400/40"
              >
                <span className="mb-4 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/10 border border-amber-400/30 text-sm font-mono font-bold text-amber-400">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h4 className="mb-2 text-lg font-semibold text-white">
                  {value.title}
                </h4>
                <p className="text-sm leading-relaxed text-slate-300">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
