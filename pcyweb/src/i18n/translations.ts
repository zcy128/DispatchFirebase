export type Language = 'en' | 'zh'

export interface ServiceItem {
  id: string
  title: string
  description: string
}

export interface StatItem {
  value: string
  label: string
}

export interface ValueItem {
  title: string
  description: string
}

export interface Translations {
  nav: {
    about: string
    services: string
    contact: string
    cta: string
  }
  hero: {
    badge: string
    title: string
    subtitle: string
    cta: string
    secondaryCta: string
  }
  stats: StatItem[]
  about: {
    title: string
    description: string
    locationLabel: string
    location: string
    foundedLabel: string
    founded: string
    focusLabel: string
    focus: string
    valuesTitle: string
    values: ValueItem[]
  }
  services: {
    title: string
    subtitle: string
    featured: string
    items: ServiceItem[]
  }
  contact: {
    title: string
    subtitle: string
    emailLabel: string
    locationLabel: string
    cta: string
  }
  footer: {
    tagline: string
    copyright: string
    language: string
    links: {
      about: string
      services: string
      contact: string
    }
  }
}

const serviceItemsEn: ServiceItem[] = [
  {
    id: 'scheduling',
    title: 'School Bus Scheduling',
    description:
      'Core dispatch platform for school transportation companies — route planning, daily assignments, and real-time schedule management.',
  },
  {
    id: 'workforce',
    title: 'Driver, Attendant & LPN Scheduling',
    description:
      'Coordinate drivers, attendants, and Licensed Practical Nurses with shift planning, availability tracking, and role-based assignments.',
  },
  {
    id: 'arrival',
    title: 'Student & Stop Arrival Tracking',
    description:
      'Record and monitor actual arrival times for students and bus stops, ensuring accountability and on-time performance.',
  },
  {
    id: 'payroll',
    title: 'Payroll',
    description:
      'Integrated payroll processing tied to hours worked, routes completed, and workforce data — reducing manual reconciliation.',
  },
  {
    id: 'timeoff',
    title: 'Time Off Management',
    description:
      'Streamlined leave requests, approvals, and balance tracking for drivers, attendants, and support staff.',
  },
  {
    id: 'maintenance',
    title: 'Vehicle Maintenance',
    description:
      'Track maintenance schedules, service history, and repair records to keep your fleet safe and road-ready.',
  },
  {
    id: 'incidents',
    title: 'Incident Reporting & Tracking',
    description:
      'Log, categorize, and follow up on incidents with full audit trails — from initial report to resolution.',
  },
  {
    id: 'sync',
    title: 'Third-Party Data Sync',
    description:
      'Seamlessly synchronize data with external systems — payroll providers, HR platforms, and school district databases.',
  },
]

const serviceItemsZh: ServiceItem[] = [
  {
    id: 'scheduling',
    title: '校巴调度系统',
    description:
      '面向校车运输公司的核心调度平台，涵盖路线规划、每日排班与实时调度管理。',
  },
  {
    id: 'workforce',
    title: '司机、陪护与 LPN 排班',
    description:
      '协调司机、陪护人员及执业护士的排班，支持班次规划、可用性追踪与角色分配。',
  },
  {
    id: 'arrival',
    title: '学生与站点到达记录',
    description:
      '记录并监控学生及站点的实际到达时间，确保准时运营与责任可追溯。',
  },
  {
    id: 'payroll',
    title: '薪资管理',
    description:
      '与工时、路线完成情况及人员数据联动的薪资处理，减少人工对账工作。',
  },
  {
    id: 'timeoff',
    title: '休假管理',
    description:
      '简化司机、陪护及支持人员的请假申请、审批与假期余额追踪流程。',
  },
  {
    id: 'maintenance',
    title: '车辆维修管理',
    description:
      '追踪保养计划、维修历史与检修记录，保障车队安全、随时上路。',
  },
  {
    id: 'incidents',
    title: '事件上报与跟踪',
    description:
      '记录、分类并跟进各类事件，提供从上报到解决的完整审计追踪。',
  },
  {
    id: 'sync',
    title: '第三方数据同步',
    description:
      '与外部系统无缝同步数据，包括薪资服务商、HR 平台及学区数据库。',
  },
]

export const translations: Record<Language, Translations> = {
  en: {
    nav: {
      about: 'About',
      services: 'Services',
      contact: 'Contact',
      cta: 'Get in Touch',
    },
    hero: {
      badge: 'Software Development · Est. 2020',
      title: 'Intelligent School Bus Operations, Simplified',
      subtitle:
        'End-to-end scheduling and workforce management software built for school transportation companies in Canada.',
      cta: 'Get in Touch',
      secondaryCta: 'Explore Services',
    },
    stats: [
      { value: '2020', label: 'Founded' },
      { value: 'Calgary', label: 'Based in Alberta' },
      { value: '20+', label: 'Core Modules' },
      { value: 'B2B', label: 'Enterprise SaaS' },
    ],
    about: {
      title: 'About P&CY Technical',
      description:
        'Founded in 2020, P&CY Technical is a Calgary-based software company specializing in custom solutions for school bus operators. We build reliable, purpose-built systems that help transportation teams run smoother operations every day.',
      locationLabel: 'Location',
      location: 'Calgary, AB, Canada',
      foundedLabel: 'Founded',
      founded: '2020',
      focusLabel: 'Focus',
      focus: 'Software development for school transportation operations',
      valuesTitle: 'What We Stand For',
      values: [
        {
          title: 'Industry Expertise',
          description:
            'Deep understanding of school bus operations — from dispatch to payroll to fleet maintenance.',
        },
        {
          title: 'Reliable Engineering',
          description:
            'Production-grade systems designed for daily operational use, not one-off prototypes.',
        },
        {
          title: 'Integrated Platform',
          description:
            'One connected system instead of scattered spreadsheets, phone calls, and manual workarounds.',
        },
      ],
    },
    services: {
      title: 'Our Services',
      subtitle:
        'Comprehensive tools designed for the unique needs of school bus companies',
      featured: 'Core Product',
      items: serviceItemsEn,
    },
    contact: {
      title: 'Contact Us',
      subtitle:
        'Ready to streamline your school bus operations? We would love to hear from you.',
      emailLabel: 'Email',
      locationLabel: 'Location',
      cta: 'Send an Email',
    },
    footer: {
      tagline: 'School bus operations software · Calgary, Canada',
      copyright: 'P&CY Technical. All rights reserved.',
      language: 'Language',
      links: {
        about: 'About',
        services: 'Services',
        contact: 'Contact',
      },
    },
  },
  zh: {
    nav: {
      about: '关于我们',
      services: '业务服务',
      contact: '联系我们',
      cta: '联系我们',
    },
    hero: {
      badge: '软件开发 · 成立于 2020 年',
      title: '智能校巴运营，化繁为简',
      subtitle: '专为加拿大校车运输公司打造的端到端调度与人员管理软件',
      cta: '联系我们',
      secondaryCta: '了解服务',
    },
    stats: [
      { value: '2020', label: '成立年份' },
      { value: '卡尔加里', label: '总部所在地' },
      { value: '20+', label: '核心模块' },
      { value: 'B2B', label: '企业级 SaaS' },
    ],
    about: {
      title: '关于 P&CY Technical',
      description:
        'P&CY Technical 成立于 2020 年，是一家位于加拿大卡尔加里的软件公司，专注于为校车运营商提供定制化解决方案。我们打造可靠、专业的系统，帮助运输团队每天更高效地运营。',
      locationLabel: '注册地',
      location: '加拿大阿尔伯塔省卡尔加里',
      foundedLabel: '成立时间',
      founded: '2020 年',
      focusLabel: '业务方向',
      focus: '校车运输运营领域的软件开发',
      valuesTitle: '我们的理念',
      values: [
        {
          title: '行业深耕',
          description: '深入理解校车运营全流程，从调度到薪资再到车队维护。',
        },
        {
          title: '可靠工程',
          description: '面向日常生产环境的企业级系统，而非一次性原型。',
        },
        {
          title: '一体化平台',
          description: '用一套互联系统取代分散的电子表格、电话沟通和手工流程。',
        },
      ],
    },
    services: {
      title: '我们的服务',
      subtitle: '专为校车公司独特需求设计的全方位管理工具',
      featured: '核心产品',
      items: serviceItemsZh,
    },
    contact: {
      title: '联系我们',
      subtitle: '准备好优化您的校巴运营了吗？我们期待与您交流。',
      emailLabel: '邮箱',
      locationLabel: '地址',
      cta: '发送邮件',
    },
    footer: {
      tagline: '校巴运营软件 · 加拿大卡尔加里',
      copyright: 'P&CY Technical 版权所有',
      language: '语言',
      links: {
        about: '关于我们',
        services: '业务服务',
        contact: '联系我们',
      },
    },
  },
}
