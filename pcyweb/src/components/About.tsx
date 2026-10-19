import { useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { useScrollReveal } from '../hooks/useScrollReveal'

export default function About() {
  const { t, language } = useLanguage()
  const { ref, visible } = useScrollReveal<HTMLDivElement>()
  const [activeSlide, setActiveSlide] = useState(0)

  const infoCards = [
    { label: t.about.locationLabel, value: t.about.location },
    { label: t.about.foundedLabel, value: t.about.founded },
    { label: t.about.focusLabel, value: t.about.focus },
  ]

  const driverSlides = [
    {
      id: 'checkin',
      title: language === 'zh' ? '班次签到' : 'Shift Check-in',
      description: language === 'zh' 
        ? '一键为预定路线签到打卡，结合 GPS 定位确保考勤真实有效。' 
        : 'Clock in easily for scheduled routes with instant GPS verification.',
      details: language === 'zh'
        ? '司机可在发车前秒级完成班次签到。系统自动利用高精度GPS校验位置，打卡数据实时同步至调度控制台与薪资模块，免去手动纸质记录。'
        : 'Drivers can clock in for scheduled runs in seconds. The app uses high-precision GPS to verify driver location and logs attendance directly to the dispatch console and payroll module, eliminating manual paperwork.',
      bullets: language === 'zh'
        ? ['即时 GPS 位置校验', '自动同步打卡与薪资结算', '调度中心实时发车预警']
        : ['Instant GPS Location Verification', 'Automatic Timesheet & Pay Sync', 'Real-Time Dispatch Notifications'],
      tip: language === 'zh'
        ? '运营提示：签到数据会自动匹配学区合同，确保出勤记录 100% 合规。'
        : 'Operations Tip: Check-in data is automatically cross-referenced with school district contracts for guaranteed audit compliance.',
      image: '/driver_shift_checkin.png',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'pickup',
      title: language === 'zh' ? '学生接送' : 'Student Pickup',
      description: language === 'zh'
        ? '实时记录每个站点的上下车状态，确保乘客数据准时可追溯。'
        : 'Track real-time arrival times and verify passenger boarding lists.',
      details: language === 'zh'
        ? '陪护人员和司机可查看路线站点和乘车名单。在每个站点，只需轻点即可登记学生上下车状态，记录实际时间，为学校和家长提供高透明度的数据保障。'
        : 'Attendants and drivers can access stop-by-stop passenger manifests. Simply tap to log each student boarding and alighting, recording actual times to provide complete transparency for schools and parents.',
      bullets: language === 'zh'
        ? ['站点核对学生乘车名单', '一键登记学生上下车状态', '准点率及实际到站时间监控']
        : ['Stop-by-Stop Student Manifest', 'Tap-to-Board Student Logging', 'Actual Arrival & Departure Tracking'],
      tip: language === 'zh'
        ? '安全提示：乘车记录支持断网缓存，在网络不良区域仍可正常记录上下车。'
        : 'Safety Tip: Student boarding records support offline caching, maintaining records even in low-connectivity areas.',
      image: '/driver_student_pickup.png',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      id: 'timeoff',
      title: language === 'zh' ? '请假申请' : 'Request Time Off',
      description: language === 'zh'
        ? '随时随地提交休假申请，查看审批进度及剩余假期额度。'
        : 'Submit leaves and monitor status directly from the mobile console.',
      details: language === 'zh'
        ? '司机可直接通过移动端提交各类请假申请（病假、年假等），并查看个人假期余额。调度人员在管理端一键审批后，结果会实时推送到司机端。'
        : 'Drivers can request leave (medical, vacation, personal) on-the-go and view their balances. Dispatchers approve or deny requests from the control panel, triggering instant updates in the driver app.',
      bullets: language === 'zh'
        ? ['休假余额实时查询', '数字化申请流与历史记录', '即时推送审批通知']
        : ['Real-Time Leave Balances', 'Digital Submission & History', 'Instant Push Notifications for Approval'],
      tip: language === 'zh'
        ? '效率提示：司机请假通过审批后，系统会自动在对应日期的排班中移除该司机，提醒调度安排替班。'
        : 'Efficiency Tip: Approved leaves automatically flag the driver as unavailable on the dispatch board, alerting schedulers to assign backups.',
      image: '/driver_time_off.png',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      id: 'expense',
      title: language === 'zh' ? '报销申请' : 'Expense Claim',
      description: language === 'zh'
        ? '拍摄收据照片以申请燃料或车辆保养费用报销。'
        : 'Take photos of receipts to claim fuel or maintenance reimbursements.',
      details: language === 'zh'
        ? '司机在外遇到加油、车辆清洗或紧急维修费用时，可用手机拍照上传发票。系统自动归纳整理并递交到财务控制台，极大缩短人工审核与报销周期。'
        : 'When incurring fuel, washing, or emergency repair expenses on the road, drivers can capture and upload receipts on-the-go. The claim is routed straight to the finance dashboard for fast reconciliation.',
      bullets: language === 'zh'
        ? ['发票与收据拍照直传', '费用分类智能统计', '直连薪资与财务结算系统']
        : ['Mobile Receipt Image Capture', 'Expense Category Categorization', 'Direct Link to Payroll Reimbursements'],
      tip: language === 'zh'
        ? '财务提示：支持多币种及省份税率选择，报销单据可一键导出为 Excel/PDF。'
        : 'Finance Tip: Supports custom fuel tax inputs and generates exportable receipt audit trails for easy accounting.',
      image: '/driver_expense_reimburse.png',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h12a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0013 2H9zM11 9.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm-3 6.5a1 1 0 110-2h8a1 1 0 110 2H8z" />
        </svg>
      )
    },
    {
      id: 'defect',
      title: language === 'zh' ? '故障上报 (DVIR)' : 'Report Defect (DVIR)',
      description: language === 'zh'
        ? '进行数字化 DVIR 检查，勾选并提交车辆缺陷，保障行车安全。'
        : 'Perform digital DVIR inspections and flag issues to dispatch.',
      details: language === 'zh'
        ? '出车前和收车后的车辆安全检查（DVIR）对合规至关重要。司机可在移动端勾选刹车、指示灯、轮胎状态。如发现故障缺陷，可拍照上传并详述问题，直接向车间派发工单。'
        : 'Pre-trip and post-trip Driver Vehicle Inspection Reports (DVIR) keep your fleet compliant. Drivers check off item lists (brakes, lights, tires, fluid levels) and submit photos of defects to alert the maintenance garage instantly.',
      bullets: language === 'zh'
        ? ['合规出车前后数码点检表', '故障零部件拍照上传', '直通维保部门的工单流']
        : ['Compliant Pre/Post-Trip Checklist', 'Visual Defect Photo Upload', 'Direct-to-Garage Work Order Routing'],
      tip: language === 'zh'
        ? '合规提示：故障上报功能完美对接 DOT / 交通部安全法规要求，保存完整的维保审计链条。'
        : 'Compliance Tip: This module is designed to satisfy DOT and provincial school bus safety inspection standards, maintaining full audit trails.',
      image: '/driver_vehicle_defect.png',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    },
  ]

  return (
    <section id="about" className="bg-white px-6 py-20 md:py-28">
      <div
        ref={ref}
        className={`reveal mx-auto max-w-5xl ${visible ? 'visible' : ''}`}
      >
        {/* Section 1: Company Profile */}
        <div className="mb-16">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-primary md:text-4xl">
              {t.about.title}
            </h2>
            <p className="text-lg leading-relaxed text-muted">
              {t.about.description}
            </p>
          </div>

          <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
            {infoCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-slate-200 bg-surface p-6 text-center transition-all duration-200 hover:shadow-card-hover hover:scale-[1.02] cursor-pointer"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-accent">
                  {card.label}
                </p>
                <p className="mt-3 text-base font-semibold leading-snug text-primary">
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Interactive Showcase */}
        <div className="border-t border-slate-100 pt-16 mb-20">
          <div className="text-center mb-10">
            <h3 className="text-2xl font-bold text-primary md:text-3xl">
              {language === 'zh' ? '司机端移动控制台演示' : 'Interactive Driver Mobile Console'}
            </h3>
            <p className="text-muted mt-2 max-w-2xl mx-auto text-sm md:text-base">
              {language === 'zh' 
                ? '双语企业级移动应用，帮助司机与乘务员便捷、安全地完成每日运输任务。' 
                : 'Bilingual enterprise mobile application helping drivers and attendants complete transportation runs with efficiency.'}
            </p>
          </div>

          {/* Horizontal Pills Selector */}
          <div className="flex flex-wrap justify-center gap-2 mb-12 border-b border-slate-100 pb-6">
            {driverSlides.map((slide, index) => {
              const isActive = index === activeSlide
              return (
                <button
                  key={slide.id}
                  onClick={() => setActiveSlide(index)}
                  className={`inline-flex items-center gap-2.5 px-5 py-3 rounded-full text-xs font-semibold tracking-wide border transition-all duration-200 focus:outline-none cursor-pointer ${
                    isActive
                      ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20'
                      : 'bg-white text-muted border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <span className={isActive ? 'text-white' : 'text-accent'}>
                    {slide.icon}
                  </span>
                  <span>{slide.title}</span>
                </button>
              )
            })}
          </div>

          {/* 50/50 Split Showcase Grid */}
          <div className="grid gap-12 items-center md:grid-cols-12">
            {/* Left Column: Mockup Image (Bigger size max-w-[420px]) */}
            <div className="md:col-span-6 relative flex flex-col items-center justify-center">
              {/* Background decorative glow */}
              <div className="absolute -inset-4 bg-accent/5 rounded-full blur-3xl opacity-60" aria-hidden="true" />
              
              <div className="relative w-full max-w-[420px] rounded-3xl overflow-hidden border border-slate-100 bg-white shadow-2xl transition-all duration-500 hover:scale-[1.01]">
                <img
                  src={driverSlides[activeSlide].image}
                  alt={driverSlides[activeSlide].title}
                  className="w-full h-auto object-cover transition-opacity duration-300"
                  loading="lazy"
                />
              </div>

              {/* Slider Dots Indicator */}
              <div className="flex gap-2 mt-6 z-10">
                {driverSlides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveSlide(index)}
                    className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                      index === activeSlide ? 'w-5 bg-accent' : 'w-2 bg-slate-300 hover:bg-slate-400'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Right Column: Detailed Caption & Capabilities */}
            <div className="md:col-span-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-accent-pale text-accent">
                  {driverSlides[activeSlide].icon}
                </div>
                <h4 className="text-xl font-bold text-primary md:text-2xl">
                  {driverSlides[activeSlide].title}
                </h4>
              </div>

              <p className="text-base leading-relaxed text-muted mb-6">
                {driverSlides[activeSlide].details}
              </p>

              {/* Key Capabilities */}
              <div className="mb-6">
                <h5 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">
                  {language === 'zh' ? '关键能力' : 'Key Capabilities'}
                </h5>
                <ul className="space-y-2.5">
                  {driverSlides[activeSlide].bullets.map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-muted">
                      <svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Highlight Tip Box */}
              <div className="p-4 rounded-xl border border-accent/10 bg-accent/5 flex items-start gap-3">
                <svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs leading-relaxed text-primary/80 font-medium">
                  {driverSlides[activeSlide].tip}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Core Values */}
        <div>
          <h3 className="mb-8 text-center text-2xl font-bold text-primary">
            {t.about.valuesTitle}
          </h3>
          <div className="grid gap-6 md:grid-cols-3">
            {t.about.values.map((value, index) => (
              <div
                key={value.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition-shadow duration-200 hover:shadow-card-hover"
              >
                <span className="mb-4 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent-pale text-sm font-bold text-accent">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h4 className="mb-2 text-lg font-semibold text-primary">
                  {value.title}
                </h4>
                <p className="text-sm leading-relaxed text-muted">
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
