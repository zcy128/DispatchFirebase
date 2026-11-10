export type Language = 'en' | 'fr'

export interface EcosystemAppItem {
  id: string
  title: string
  role: string
  badge: string
  description: string
  features: string[]
  cloudDemoUrl: string
  cloudMirrorUrl?: string
  cloudAuth: string
  enterpriseDemoUrl: string
  enterpriseAuth: string
  image: string
}

export interface EditionItem {
  id: string
  name: string
  badge: string
  target: string
  tagline: string
  database: string
  backend: string
  realtime: string
  hosting: string
  features: string[]
  recommended: boolean
  demoUrl: string
  demoLabel: string
}

export interface HighlightItem {
  number: string
  title: string
  description: string
}

export interface StatItem {
  value: string
  label: string
}

export interface DemoAccountItem {
  app: string
  tech: string
  url: string
  mirrorUrl?: string
  username?: string
  password?: string
  instructions: string
  roleScope: string
}

export interface DemoEditionTab {
  id: 'cloud' | 'enterprise'
  tabLabel: string
  name: string
  badge: string
  tagline: string
  accounts: DemoAccountItem[]
  tip: string
}

export interface ValueItem {
  title: string
  description: string
}

export interface DriverSlideItem {
  id: string
  title: string
  description: string
  details: string
  bullets: string[]
  tip: string
}

export interface Translations {
  nav: {
    ecosystem: string
    editions: string
    highlights: string
    about: string
    demo: string
    contact: string
    cta: string
  }
  hero: {
    badge: string
    title: string
    subtitle: string
    cta: string
    secondaryCta: string
    editionsPill: string
  }
  stats: StatItem[]
  ecosystem: {
    title: string
    subtitle: string
    apps: EcosystemAppItem[]
  }
  editions: {
    title: string
    subtitle: string
    items: EditionItem[]
    summaryNote: string
  }
  highlights: {
    title: string
    subtitle: string
    items: HighlightItem[]
  }
  demoAccess: {
    title: string
    subtitle: string
    cloudTab: DemoEditionTab
    enterpriseTab: DemoEditionTab
  }
  about: {
    title: string
    description: string
    locationLabel: string
    location: string
    foundedLabel: string
    founded: string
    focusLabel: string
    focus: string
    showcaseTitle: string
    showcaseSubtitle: string
    keyCapabilities: string
    driverSlides: DriverSlideItem[]
    valuesTitle: string
    values: ValueItem[]
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
      ecosystem: string
      editions: string
      highlights: string
      about: string
      contact: string
    }
  }
}

export const translations: Record<Language, Translations> = {
  en: {
    nav: {
      ecosystem: 'Applications',
      editions: 'Editions',
      highlights: 'Highlights',
      about: 'About',
      demo: 'Live Demo',
      contact: 'Contact',
      cta: 'Explore Demo',
    },
    hero: {
      badge: 'Student Transportation Operating System',
      title: 'Unified School Bus Operations, Seamlessly Connected',
      subtitle:
        'A mission-critical operations suite connecting dispatchers, bus drivers, and parents in real time. Available in two production-tested architectures: Cloud Edition (Firebase serverless for agile SMB fleets) and Enterprise Edition (.NET 10 + MySQL/SQL Server for multi-yard school districts).',
      cta: 'Explore Live Demos',
      secondaryCta: 'Compare Architecture Editions',
      editionsPill: 'Cloud Serverless (Firebase) & Enterprise (.NET 10 + SQL)',
    },
    stats: [
      { value: '3', label: 'Dedicated Client Apps' },
      { value: '2', label: 'Deployment Editions' },
      { value: '< 100ms', label: 'Real-Time Sync' },
      { value: '13', label: 'Role-Based Matrices' },
    ],
    ecosystem: {
      title: 'Three Purpose-Built Applications, One Connected System',
      subtitle:
        'Every stakeholder in school transportation has unique daily workflows. Dispatch gives dispatchers, drivers, and parents their own dedicated interface.',
      apps: [
        {
          id: 'dispatch',
          title: 'Dispatch Console',
          role: 'For Dispatchers & Operations Managers',
          badge: 'Desktop & PWA',
          description:
            'The central operational nerve center for shift scheduling, live route monitoring, fleet compliance, and shift-driven payroll.',
          features: [
            'Three-run daily structure: Morning (AM), Midday, and Afternoon (PM) shifts',
            'Live attendance board, driver check-in tracker & stop arrivals',
            'Shift-linked payroll engine with automated EI hours calculation',
            'Fleet maintenance gatekeeper — defect vehicles automatically quarantined',
            'Automated open cover shifts generated on driver time-off approval',
            'AI Dispatch Copilot for intelligent operational guidance & query assist',
          ],
          cloudDemoUrl: 'https://schoolbus.pcytech.ca/',
          cloudMirrorUrl: 'https://schoolbusdispatchapp.web.app/',
          cloudAuth: 'Click "Demo Access" → "Demo Admin" (AI Copilot: /?mode=ai)',
          enterpriseDemoUrl: 'https://dispatch.pcytech.ca',
          enterpriseAuth: 'High-concurrency enterprise dispatch console on .NET 10 & SignalR',
          image: '/bus_dashboard_mockup.png',
        },
        {
          id: 'driver',
          title: 'Driver Mobile App',
          role: 'For Drivers, Attendants & Care Staff',
          badge: 'Mobile Web & Native App',
          description:
            'A streamlined on-the-road workflow enabling drivers to complete route runs, verify student boarding, and report vehicle defects effortlessly.',
          features: [
            'Daily shift jobs with turn-by-turn stop schedules and directions',
            'Student passenger manifest with single-tap boarding and alighting verification',
            'Schedule 5 Pre-trip & Post-trip inspection checklists (DVIR)',
            'Instant defect photo capture routed directly to the maintenance garage',
            'Mobile leave requests & on-the-road fuel/expense reimbursements',
            'One-click GPS-verified shift check-in synced with dispatch and payroll',
          ],
          cloudDemoUrl: 'https://schoolbus.pcytech.ca/driver',
          cloudMirrorUrl: 'https://schoolbusdispatchapp.web.app/driver',
          cloudAuth: 'Click "Quick Demo Credentials" (driver1d / Dispatch2026!)',
          enterpriseDemoUrl: 'https://driver.pcytech.ca',
          enterpriseAuth: 'Full mobile workflows with sub-second SignalR synchronization',
          image: '/driver_app_mockup.png',
        },
        {
          id: 'parent',
          title: 'Parent Portal & App',
          role: 'For Parents & Guardians',
          badge: 'Mobile & Web Portal',
          description:
            'Complete transparency and peace of mind for families — providing live GPS tracking, scheduled arrival times, and instant delay notifications.',
          features: [
            'Enrolled student roster linked directly to schools and routes',
            'Exact morning pickup and afternoon drop-off scheduled times',
            'Real-time bus GPS tracking on an interactive live map with live ETAs',
            'Student boarding confirmation & direct absence self-reporting',
            'Push alerts for bus delays, route changes, and urgent safety announcements',
            'Direction C Family Bento calming dark UI with passwordless OTP login',
          ],
          cloudDemoUrl: 'https://schoolbus.pcytech.ca/parent',
          cloudMirrorUrl: 'https://schoolbusdispatchapp.web.app/parent',
          cloudAuth: 'Tap "Demo Phone" or "Demo Email" → Tap "Dev Passcode" banner',
          enterpriseDemoUrl: 'https://parent.pcytech.ca',
          enterpriseAuth: 'Live bus GPS tracking & Family Bento arrival alerts',
          image: '/driver_student_pickup.png',
        },
      ],
    },
    editions: {
      title: 'Two Scalable Editions, Tailored to Your Fleet Size',
      subtitle:
        'Choose the optimal backend architecture for your organization — whether you need zero-maintenance serverless cloud or enterprise relational private hosting.',
      items: [
        {
          id: 'cloud',
          name: 'Cloud Edition (Firebase)',
          badge: 'Small & Medium Fleets',
          target: 'Agile Operators, Growing Fleets & Single/Dual Yard Contractors (< 2,000 shifts/day)',
          tagline: 'Zero-Maintenance, Serverless & Fast 24-Hour Rollout',
          database: 'Google Cloud Firestore (Real-Time NoSQL) + BigQuery Cold Archive',
          backend: 'Go (Golang) High-Performance API Server & Cloud Run',
          realtime: 'Firestore Real-time Listeners & SSE Streams',
          hosting: 'Fully Managed Serverless Cloud (GCP / Firebase)',
          features: [
            'Zero server management or hardware provisioning required',
            'Cost-effective pay-as-you-grow model with minimal startup costs',
            'Instant multi-device live synchronization via Firestore snapshots',
            'Seamless PWA offline caching for drivers in low-connectivity areas',
            'Automated 30-day hot storage with BigQuery cold archive for audit records',
            'Native Anthropic Model Context Protocol (MCP) server for external AI tools',
          ],
          recommended: false,
          demoUrl: 'https://schoolbus.pcytech.ca/',
          demoLabel: 'Launch Cloud Demo',
        },
        {
          id: 'enterprise',
          name: 'Enterprise Edition (.NET / SQL)',
          badge: 'Large Enterprises & School Boards',
          target: 'Multi-Yard Operators, Large Fleets & Municipal School Districts (80 - 1,000+ Buses)',
          tagline: 'High Concurrency, Enterprise Relational & Private Hosting',
          database: 'MySQL 8.4+ / Microsoft SQL Server 2022 with Entity Framework Core',
          backend: '.NET 10 (ASP.NET Core Minimal APIs) + Quartz.NET Scheduler',
          realtime: 'ASP.NET Core SignalR WebSockets (< 100ms push)',
          hosting: 'Self-Hosted VPC, On-Premises, Oracle Cloud (OCI), or AWS',
          features: [
            'Strict ACID relational data transactions with enterprise database support',
            'High-throughput architecture handling hundreds of simultaneous bus streams',
            'Quartz.NET automated daily dispatch generator & simulation engine',
            'Microsoft HybridCache multi-tier in-memory and distributed caching',
            '13 built-in industry role templates with yard-level data isolation',
            'Supports on-premises deployment, private VPCs, and corporate single sign-on',
          ],
          recommended: true,
          demoUrl: 'https://dispatch.pcytech.ca',
          demoLabel: 'Launch Enterprise Demo',
        },
      ],
      summaryNote:
        'Both editions share identical core frontends and domain capabilities, ensuring a seamless user experience regardless of the underlying backend architecture.',
    },
    highlights: {
      title: 'Core Operational Advantages',
      subtitle:
        'Engineered specifically for the complex operational realities of North American student transportation.',
      items: [
        {
          number: '01',
          title: 'Three-Run Daily Shift Structure',
          description:
            'Organizes each school day into Morning (AM), Midday, and Afternoon (PM) shifts with live attendance, arrival records, and progress monitoring.',
        },
        {
          number: '02',
          title: 'Student-Level Stop Precision',
          description:
            'Every stop links directly to designated student manifests, street addresses, boarding directions, and school bell times.',
        },
        {
          number: '03',
          title: 'Shift-Linked Payroll Engine',
          description:
            'Compensation rates calculated by school board, route, shift type, role, and weekday rules. Approving shifts computes EI hours and wages instantly.',
        },
        {
          number: '04',
          title: 'Fleet Maintenance Gatekeeper',
          description:
            'Tracks commercial licenses, safety expirations, and oil/tire history. Any vehicle flagged with an active defect is automatically excluded from dispatch.',
        },
        {
          number: '05',
          title: 'Sub-Second Real-Time Push',
          description:
            'Sub-second messaging broadcasts driver check-ins, stop arrivals, student pickups, and live GPS coordinates directly to dispatch screens and parent maps.',
        },
        {
          number: '06',
          title: 'Seamless Absence Cover Shifts',
          description:
            'When drivers request time-off and HR approves it, open replacement shifts are automatically generated on the dispatch board for immediate reassignment.',
        },
        {
          number: '07',
          title: '13-Role Security Matrix',
          description:
            'Fine-grained role templates (Admin, Dispatcher, Yard Manager, Safety Officer, HR, Fleet Mechanic, etc.) isolate data by company, yard, or individual.',
        },
      ],
    },
    demoAccess: {
      title: 'Explore Live Demonstrations',
      subtitle:
        'Both Cloud (Firebase) and Enterprise (.NET/SQL) environments are publicly accessible online with preconfigured credentials and automated demo workflows.',
      cloudTab: {
        id: 'cloud',
        tabLabel: 'Cloud Edition (Firebase)',
        name: 'Cloud Serverless Suite',
        badge: 'Firebase & Google Cloud Run · Zero Maintenance',
        tagline: 'Tailored for small-to-medium operators (< 2,000 daily shifts). Auto-scales to zero with 1-click demo login.',
        accounts: [
          {
            app: 'Dispatch Office Console (web)',
            tech: 'React 19 · TypeScript · Tailwind',
            url: 'https://schoolbus.pcytech.ca/',
            mirrorUrl: 'https://schoolbusdispatchapp.web.app/',
            instructions: 'Click "Demo Access" → "Demo Admin" (AI Copilot: /?mode=ai)',
            roleScope: 'Operations Administrator — Shift Kanban, substitute driver planning, inspection quarantine, and bi-weekly payroll workbench.',
          },
          {
            app: 'Driver & Monitor Hub (driver_app)',
            tech: 'Flutter · PWA Offline Hub',
            url: 'https://schoolbus.pcytech.ca/driver',
            mirrorUrl: 'https://schoolbusdispatchapp.web.app/driver',
            instructions: 'Click "Quick Demo Credentials" (driver1d / Dispatch2026!) → Tap Sign In',
            roleScope: 'Field Driver & Attendant — Turn-by-turn route, student boarding, Schedule 5 inspection checklist, and defect reporting.',
          },
          {
            app: 'Parent Bus Tracker App (parent_app)',
            tech: 'Flutter · Family Bento Theme',
            url: 'https://schoolbus.pcytech.ca/parent',
            mirrorUrl: 'https://schoolbusdispatchapp.web.app/parent',
            instructions: 'Tap "Demo Phone" or "Demo Email" → Tap amber "Dev Passcode" banner',
            roleScope: 'Student Parent — Live GPS bus map, arrival ETA countdown (< 2 MINS AWAY), student boarding notices, and absence reporting.',
          },
          {
            app: 'Model Context Protocol (MCP) AI',
            tech: 'Go Microservice · Cloud Run',
            url: 'https://dispatch-api-kv7qum3dca-nn.a.run.app/api/mcp',
            instructions: 'Standard Anthropic MCP protocol token authentication',
            roleScope: 'AI Agent Endpoint — Connects Claude Desktop, Cursor, and Gemini CLI to securely query shifts and trigger dispatch actions.',
          },
        ],
        tip: 'Cloud Serverless Architecture: The Firebase edition is designed for fast 24-hour onboarding with true pay-as-you-grow economics, requiring zero server maintenance or physical hardware.',
      },
      enterpriseTab: {
        id: 'enterprise',
        tabLabel: 'Enterprise Edition (.NET / SQL)',
        name: 'Enterprise Relational Suite',
        badge: '.NET 10 + MySQL / SQL Server · High Concurrency',
        tagline: 'Engineered for large multi-yard school districts with Quartz.NET simulation engine and SignalR WebSockets.',
        accounts: [
          {
            app: 'Dispatch Console',
            tech: 'Flutter Web & PWA',
            url: 'https://dispatch.pcytech.ca',
            instructions: 'Instant 1-Click Access · Live Simulation Engine',
            roleScope: 'Full Administrator — Complete access to dispatch sheets, routes, fleet compliance, payroll review, and AI assistant.',
          },
          {
            app: 'Driver Mobile Web',
            tech: 'Flutter Web / Mobile',
            url: 'https://driver.pcytech.ca',
            instructions: 'Instant 1-Click Access · Turn-by-Turn GPS Itinerary',
            roleScope: 'School Bus Driver (Employee 293) — Today’s runs, stop navigation, student boarding status, and defect reporting.',
          },
          {
            app: 'Parent Portal',
            tech: 'React 18 + Vite',
            url: 'https://parent.pcytech.ca',
            instructions: 'Instant 1-Click Access · Live Family Bento Map',
            roleScope: 'Student Parent (Liam Davis) — 2 linked students, daily schedule, and live bus GPS tracking.',
          },
          {
            app: 'Backend API Server',
            tech: '.NET 10 / SignalR WebSockets',
            url: 'https://api.pcytech.ca',
            instructions: 'High-Throughput REST API & SignalR Real-Time Hub',
            roleScope: 'Core high-throughput REST API and SignalR real-time communications hub with HybridCache.',
          },
        ],
        tip: 'Automated Simulation Engine: The Enterprise demo features a background simulation runner that advances routes on a timer, showcasing live dispatch board updates and parent map tracking without physical vehicles on the road.',
      },
    },
    about: {
      title: 'About P&CY Technical',
      description:
        'Founded in 2020 in Calgary, Alberta, P&CY Technical specializes in purpose-built software solutions for the school transportation industry. We replace fragile spreadsheets and disconnected legacy tools with unified, modern operating systems.',
      locationLabel: 'Location',
      location: 'Calgary, AB, Canada',
      foundedLabel: 'Founded',
      founded: '2020',
      focusLabel: 'Focus',
      focus: 'Student transportation operating systems & workforce dispatch',
      showcaseTitle: 'Interactive Driver Mobile Console',
      showcaseSubtitle:
        'Bilingual enterprise mobile application helping drivers and attendants complete transportation runs with efficiency.',
      keyCapabilities: 'Key Capabilities',
      driverSlides: [
        {
          id: 'checkin',
          title: 'Shift Check-in',
          description: 'Clock in easily for scheduled routes with instant GPS verification.',
          details:
            'Drivers can clock in for scheduled runs in seconds. The app uses high-precision GPS to verify driver location and logs attendance directly to the dispatch console and payroll module, eliminating manual paperwork.',
          bullets: [
            'Instant GPS Location Verification',
            'Automatic Timesheet & Pay Sync',
            'Real-Time Dispatch Notifications',
          ],
          tip: 'Operations Tip: Check-in data is automatically cross-referenced with school district contracts for guaranteed audit compliance.',
        },
        {
          id: 'pickup',
          title: 'Student Pickup',
          description: 'Track real-time arrival times and verify passenger boarding lists.',
          details:
            'Attendants and drivers can access stop-by-stop passenger manifests. Simply tap to log each student boarding and alighting, recording actual times to provide complete transparency for schools and parents.',
          bullets: [
            'Stop-by-Stop Student Manifest',
            'Tap-to-Board Student Logging',
            'Actual Arrival & Departure Tracking',
          ],
          tip: 'Safety Tip: Student boarding records support offline caching, maintaining records even in low-connectivity areas.',
        },
        {
          id: 'timeoff',
          title: 'Request Time Off',
          description: 'Submit leaves and monitor status directly from the mobile console.',
          details:
            'Drivers can request leave (medical, vacation, personal) on-the-go and view their balances. Dispatchers approve or deny requests from the control panel, triggering instant updates in the driver app.',
          bullets: [
            'Real-Time Leave Balances',
            'Digital Submission & History',
            'Instant Push Notifications for Approval',
          ],
          tip: 'Efficiency Tip: Approved leaves automatically flag the driver as unavailable on the dispatch board, alerting schedulers to assign backups.',
        },
        {
          id: 'expense',
          title: 'Expense Claim',
          description: 'Take photos of receipts to claim fuel or maintenance reimbursements.',
          details:
            'When incurring fuel, washing, or emergency repair expenses on the road, drivers can capture and upload receipts on-the-go. The claim is routed straight to the finance dashboard for fast reconciliation.',
          bullets: [
            'Mobile Receipt Image Capture',
            'Expense Category Categorization',
            'Direct Link to Payroll Reimbursements',
          ],
          tip: 'Finance Tip: Supports custom fuel tax inputs and generates exportable receipt audit trails for easy accounting.',
        },
        {
          id: 'defect',
          title: 'Report Defect (DVIR)',
          description: 'Perform digital DVIR inspections and flag issues to dispatch.',
          details:
            'Pre-trip and post-trip Driver Vehicle Inspection Reports (DVIR) keep your fleet compliant. Drivers check off item lists (brakes, lights, tires, fluid levels) and submit photos of defects to alert the maintenance garage instantly.',
          bullets: [
            'Compliant Pre/Post-Trip Checklist',
            'Visual Defect Photo Upload',
            'Direct-to-Garage Work Order Routing',
          ],
          tip: 'Compliance Tip: This module is designed to satisfy DOT and provincial school bus safety inspection standards, maintaining full audit trails.',
        },
      ],
      valuesTitle: 'What We Stand For',
      values: [
        {
          title: 'Industry Expertise',
          description:
            'Deep operational understanding of student transportation — from multi-tier run scheduling to driver compliance and payroll.',
        },
        {
          title: 'Reliable Engineering',
          description:
            'Mission-critical architecture designed for daily morning and afternoon peaks with sub-second real-time responsiveness.',
        },
        {
          title: 'Unified Platform',
          description:
            'A single connected operating system uniting dispatchers, drivers, mechanics, HR, and parents without paper friction.',
        },
      ],
    },
    contact: {
      title: 'Ready to Modernize Your Operations?',
      subtitle:
        'Whether you manage a 10-bus agile fleet or a 500-bus regional school district contract, our team is ready to assist with live demonstrations, pilot setups, and architecture consultations.',
      emailLabel: 'Direct Email',
      locationLabel: 'Headquarters',
      cta: 'Get in Touch',
    },
    footer: {
      tagline: 'Student Transportation Operating System · Calgary, Canada',
      copyright: 'P&CY Technical. All rights reserved.',
      language: 'Language',
      links: {
        ecosystem: 'Applications',
        editions: 'Editions',
        highlights: 'Highlights',
        about: 'About',
        contact: 'Contact',
      },
    },
  },
  fr: {
    nav: {
      ecosystem: 'Applications',
      editions: 'Éditions',
      highlights: 'Avantages clés',
      about: 'À propos',
      demo: 'Démos en direct',
      contact: 'Contact',
      cta: 'Essayer la démo',
    },
    hero: {
      badge: "Système d'exploitation du transport scolaire",
      title: 'Gestion unifiée du transport scolaire, fluide et connectée',
      subtitle:
        "Une suite opérationnelle critique connectant répartiteurs, chauffeurs et parents en temps réel. Disponible en deux architectures éprouvées en production : Édition Cloud (Firebase serverless pour flottes PME agiles) et Édition Entreprise (.NET 10 + MySQL/SQL Server pour grands centres de services scolaires).",
      cta: 'Découvrir les démos en direct',
      secondaryCta: 'Comparer les architectures',
      editionsPill: 'Édition Cloud (Firebase) & Édition Entreprise (.NET 10 + SQL)',
    },
    stats: [
      { value: '3', label: 'Applications dédiées' },
      { value: '2', label: 'Architectures de déploiement' },
      { value: '< 100ms', label: 'Synchronisation temps réel' },
      { value: '13', label: 'Rôles métier paramétrables' },
    ],
    ecosystem: {
      title: 'Trois applications spécialisées, une plateforme unique',
      subtitle:
        "Chaque acteur du transport scolaire possède des flux de travail spécifiques. Dispatch offre aux répartiteurs, aux chauffeurs et aux parents leur propre interface dédiée.",
      apps: [
        {
          id: 'dispatch',
          title: 'Console de régulation & répartition',
          role: "Pour répartiteurs et gestionnaires d'exploitation",
          badge: 'Web & PWA Bureau',
          description:
            "Le centre névralgique pour la planification des services, le suivi des circuits en direct, la conformité de la flotte et la paie automatisée.",
          features: [
            'Structure quotidienne à 3 services : Matin (AM), Midi et Après-midi (PM)',
            'Tableau de bord des présences, pointages chauffeurs et suivi des arrêts',
            'Moteur de paie automatisé calculant les heures d’assurance-emploi (AE) et salaires',
            'Garde-barrière d’entretien : mise en quarantaine immédiate des véhicules défectueux',
            'Génération automatisée des services de remplacement lors des congés approuvés',
            'Copilote IA Dispatch pour l’aide à la décision et l’assistance opérationnelle',
          ],
          cloudDemoUrl: 'https://schoolbus.pcytech.ca/',
          cloudMirrorUrl: 'https://schoolbusdispatchapp.web.app/',
          cloudAuth: 'Cliquez sur « Demo Access » → « Demo Admin » (Copilote IA : /?mode=ai)',
          enterpriseDemoUrl: 'https://dispatch.pcytech.ca',
          enterpriseAuth: 'Console de régulation haute concurrence sur .NET 10 & SignalR',
          image: '/bus_dashboard_mockup.png',
        },
        {
          id: 'driver',
          title: 'Application mobile chauffeur',
          role: 'Pour chauffeurs, berlingots et accompagnateurs',
          badge: 'Mobile Web & App native',
          description:
            'Un flux de travail fluide permettant aux chauffeurs d’exécuter leurs circuits, de pointer les élèves et de signaler les anomalies sans effort.',
          features: [
            'Services du jour avec guidage virage par virage et horaires d’arrêts',
            'Manifeste des élèves avec validation d’embarquement et descente en un geste',
            'Ronde de sécurité numérique Schedule 5 avant/après départ (DVIR)',
            'Prise de photo immédiate des défaillances transmise au garage',
            'Demandes de congés en mobilité et notes de frais de carburant/entretien',
            'Pointage vérifié par GPS en un clic synchronisé avec la paie',
          ],
          cloudDemoUrl: 'https://schoolbus.pcytech.ca/driver',
          cloudMirrorUrl: 'https://schoolbusdispatchapp.web.app/driver',
          cloudAuth: 'Cliquez sur « Quick Demo Credentials » (driver1d / Dispatch2026!)',
          enterpriseDemoUrl: 'https://driver.pcytech.ca',
          enterpriseAuth: 'Interface mobile chauffeur avec synchronisation temps réel SignalR',
          image: '/driver_app_mockup.png',
        },
        {
          id: 'parent',
          title: 'Portail & Suivi parents',
          role: 'Pour parents et tuteurs légaux',
          badge: 'Portail Web & Mobile',
          description:
            'Transparence totale et sérénité pour les familles : géolocalisation GPS en direct de l’autobus, horaires prévus et alertes de retard.',
          features: [
            'Profils d’élèves rattachés directement à leurs écoles et circuits respectifs',
            'Horaires précis de passage le matin et de dépose l’après-midi',
            'Suivi GPS de l’autobus en direct avec heure d’arrivée estimée (< 2 MIN)',
            'Confirmation de montée à bord et déclaration d’absence en direct',
            'Notifications push pour retards, modifications ou intempéries',
            'Design apaisant Family Bento avec authentification sécurisée par code OTP',
          ],
          cloudDemoUrl: 'https://schoolbus.pcytech.ca/parent',
          cloudMirrorUrl: 'https://schoolbusdispatchapp.web.app/parent',
          cloudAuth: 'Touchez « Demo Phone » ou « Demo Email » → Touchez la bannière jaune « Dev Passcode »',
          enterpriseDemoUrl: 'https://parent.pcytech.ca',
          enterpriseAuth: 'Suivi GPS de l’autobus en direct et alertes d’arrivée Family Bento',
          image: '/driver_student_pickup.png',
        },
      ],
    },
    editions: {
      title: 'Deux éditions évolutives selon la taille de votre flotte',
      subtitle:
        'Choisissez l’architecture backend idéale pour votre organisation : cloud serverless sans maintenance ou hébergement privé relationnel pour grands parcs.',
      items: [
        {
          id: 'cloud',
          name: 'Édition Cloud (Firebase)',
          badge: 'Flottes PME & Opérateurs agiles',
          target: 'Transporteurs indépendants, flottes en croissance (< 2 000 services/jour)',
          tagline: 'Zéro maintenance serveur · Véritable Serverless · Déploiement en 24h',
          database: 'Google Cloud Firestore (NoSQL temps réel) + Archivage BigQuery',
          backend: 'Microservices API Go (Golang) haute performance & Cloud Run',
          realtime: 'Écouteurs temps réel Firestore & flux SSE',
          hosting: 'Cloud Serverless entièrement géré (GCP / Firebase)',
          features: [
            'Aucune gestion de serveur ni achat de matériel requis',
            'Facturation à l’usage économique avec coûts initiaux minimes',
            'Synchronisation multi-écrans instantanée via Firestore Snapshots',
            'Fonctionnement hors ligne PWA fluide dans les zones mal couvertes',
            'Données actives sur 30 jours et archivage réglementaire dans BigQuery',
            'Serveur Anthropic Model Context Protocol (MCP) pour agents IA externes',
          ],
          recommended: false,
          demoUrl: 'https://schoolbus.pcytech.ca/',
          demoLabel: 'Lancer la démo Firebase',
        },
        {
          id: 'enterprise',
          name: 'Édition Entreprise (.NET / SQL)',
          badge: 'Grands groupes & Centres de services scolaires',
          target: 'Exploitants multi-dépôts, grands parcs et conseils scolaires (80 à 1 000+ autobus)',
          tagline: 'Haute concurrence · Données relationnelles ACID · Hébergement privé',
          database: 'MySQL 8.4+ / Microsoft SQL Server 2022 avec Entity Framework Core',
          backend: '.NET 10 (ASP.NET Core Minimal APIs) + Moteur de tâches Quartz.NET',
          realtime: 'WebSockets natifs ASP.NET Core SignalR (< 100 ms)',
          hosting: 'VPC dédié, sur site (On-Premises), Oracle Cloud (OCI) ou AWS',
          features: [
            'Transactions relationnelles strictes conformes aux exigences comptables',
            'Architecture à très haut débit gérant des centaines de flux simultanés',
            'Générateur de régulation quotidien et moteur de simulation Quartz.NET',
            'Cache distribué et mémoire multiniveaux Microsoft HybridCache',
            'Matrice de sécurité à 13 rôles avec isolation stricte par dépôt',
            'Prise en charge du déploiement sur site, VPC privé et SSO d’entreprise',
          ],
          recommended: true,
          demoUrl: 'https://dispatch.pcytech.ca',
          demoLabel: 'Lancer la démo Entreprise',
        },
      ],
      summaryNote:
        'Les deux éditions partagent les mêmes interfaces et fonctionnalités métier, assurant une expérience utilisateur identique quelle que soit l’architecture backend choisie.',
    },
    highlights: {
      title: 'Sept piliers opérationnels',
      subtitle:
        'Conçus spécifiquement pour répondre aux exigences réglementaires et opérationnelles du transport scolaire en Amérique du Nord.',
      items: [
        {
          number: '01',
          title: 'Structure quotidienne à 3 services',
          description:
            'Organisation rigoureuse en services du Matin (AM), du Midi et de l’Après-midi (PM) avec suivi des présences et d’avancement en temps réel.',
        },
        {
          number: '02',
          title: 'Arrêts précis par élève',
          description:
            'Chaque arrêt est relié directement aux manifestes d’élèves, adresses civiques, sens d’embarquement et horaires de cloche des écoles.',
        },
        {
          number: '03',
          title: 'Moteur de paie indexé aux services',
          description:
            'Grilles de rémunération par commission scolaire, circuit, type de service et rôle. La validation des services génère instantanément salaires et heures AE.',
        },
        {
          number: '04',
          title: 'Garde-barrière d’entretien et sécurité',
          description:
            'Suivi des permis professionnels, examens médicaux et entretiens. Tout véhicule présentant une défectuosité active est automatiquement exclu des départs.',
        },
        {
          number: '05',
          title: 'Diffusion temps réel sub-seconde',
          description:
            'Transmission instantanée des pointages chauffeurs, arrivées aux arrêts, validations d’élèves et coordonnées GPS vers les régulateurs et parents.',
        },
        {
          number: '06',
          title: 'Remplacements automatisés d’urgence',
          description:
            'Lorsqu’un chauffeur pose un congé approuvé par les RH, des services de remplacement (Cover Shifts) sont générés pour réaffectation immédiate.',
        },
        {
          number: '07',
          title: 'Matrice de sécurité à 13 rôles',
          description:
            'Profils précis (Administrateur, Répartiteur, Chef de dépôt, Sécurité, RH, Mécanicien, etc.) isolant les données par entreprise, dépôt ou individu.',
        },
      ],
    },
    demoAccess: {
      title: 'Espaces de démonstration en direct',
      subtitle:
        'Les environnements Cloud (Firebase) et Entreprise (.NET/SQL) sont accessibles en ligne avec des identifiants préconfigurés et des flux automatisés.',
      cloudTab: {
        id: 'cloud',
        tabLabel: 'Édition Cloud (Firebase)',
        name: 'Suite Cloud Serverless',
        badge: 'Firebase & Google Cloud Run · Zéro maintenance',
        tagline: 'Conçue pour les flottes de petite et moyenne taille (< 2 000 services/jour). Connexion rapide en 1 clic.',
        accounts: [
          {
            app: 'Console de régulation bureau (web)',
            tech: 'React 19 · TypeScript · Tailwind',
            url: 'https://schoolbus.pcytech.ca/',
            mirrorUrl: 'https://schoolbusdispatchapp.web.app/',
            instructions: 'Cliquez sur « Demo Access » → « Demo Admin » (IA : /?mode=ai)',
            roleScope: 'Administrateur d’exploitation — Kanban des services, gestion des remplacements, mise en quarantaine et atelier de paie bihebdomadaire.',
          },
          {
            app: 'Espace Chauffeur & Accompagnateur (driver_app)',
            tech: 'Flutter · PWA mode déconnecté',
            url: 'https://schoolbus.pcytech.ca/driver',
            mirrorUrl: 'https://schoolbusdispatchapp.web.app/driver',
            instructions: 'Cliquez sur « Quick Demo Credentials » (driver1d / Dispatch2026!) → Se connecter',
            roleScope: 'Chauffeur de terrain — Guidage d’itinéraire, embarquement des élèves, ronde de sécurité Schedule 5 et signalement d’anomalies.',
          },
          {
            app: 'Application Suivi parents (parent_app)',
            tech: 'Flutter · Thème apaisant Bento',
            url: 'https://schoolbus.pcytech.ca/parent',
            mirrorUrl: 'https://schoolbusdispatchapp.web.app/parent',
            instructions: 'Touchez « Demo Phone » ou « Demo Email » → Touchez la bannière jaune « Dev Passcode »',
            roleScope: 'Parent d’élève — Carte GPS en direct, compte à rebours d’arrivée (< 2 MIN), alertes de montée à bord et déclaration d’absence.',
          },
          {
            app: 'Protocole MCP IA (Model Context Protocol)',
            tech: 'Microservice Go · Cloud Run',
            url: 'https://dispatch-api-kv7qum3dca-nn.a.run.app/api/mcp',
            instructions: 'Authentification par jeton standard Anthropic MCP',
            roleScope: 'Point d’accès Agent IA — Permet à Claude Desktop, Cursor et Gemini CLI de requêter les services et déclencher des actions.',
          },
        ],
        tip: 'Architecture Cloud Serverless : L’édition Firebase offre une tarification évolutive pay-as-you-grow sans maintenance serveur, permettant un démarrage en 24h.',
      },
      enterpriseTab: {
        id: 'enterprise',
        tabLabel: 'Édition Entreprise (.NET / SQL)',
        name: 'Suite Entreprise Relationnelle',
        badge: '.NET 10 + MySQL / SQL Server · Haute concurrence',
        tagline: 'Conçue pour les grands exploitants multi-dépôts avec moteur de simulation Quartz.NET et SignalR.',
        accounts: [
          {
            app: 'Console de régulation',
            tech: 'Flutter Web & PWA',
            url: 'https://dispatch.pcytech.ca',
            instructions: 'Accès direct en 1 clic · Moteur de simulation en direct',
            roleScope: 'Administrateur système — Accès complet aux feuilles de route, circuits, conformité de flotte, paie et assistant IA.',
          },
          {
            app: 'Application mobile Chauffeur Web',
            tech: 'Flutter Web / Mobile',
            url: 'https://driver.pcytech.ca',
            instructions: 'Accès direct en 1 clic · Itinéraire GPS virage par virage',
            roleScope: 'Chauffeur d’autobus scolaire (Employé 293) — Missions du jour, navigation, pointage élèves et rapports de défectuosités.',
          },
          {
            app: 'Portail Parents',
            tech: 'React 18 + Vite',
            url: 'https://parent.pcytech.ca',
            instructions: 'Accès direct en 1 clic · Carte Family Bento en direct',
            roleScope: 'Parent d’élève (Liam Davis) — 2 élèves associés, horaires quotidiens et suivi GPS de l’autobus en direct.',
          },
          {
            app: 'Serveur API Backend',
            tech: '.NET 10 / SignalR WebSockets',
            url: 'https://api.pcytech.ca',
            instructions: 'Point d’accès API REST haute performance & SignalR',
            roleScope: 'Serveur API REST haute performance et passerelle temps réel SignalR avec cache distribué HybridCache.',
          },
        ],
        tip: 'Moteur de simulation automatisé : La démo Entreprise intègre un simulateur qui fait progresser les circuits selon un minuteur pour visualiser les cartes et panneaux sans véhicules physiques.',
      },
    },
    about: {
      title: 'À propos de P&CY Technical',
      description:
        "Fondée en 2020 à Calgary en Alberta, P&CY Technical est spécialisée dans les solutions logicielles dédiées au transport scolaire. Nous remplaçons les feuilles de calcul fragiles et les outils obsolètes par des systèmes d'exploitation modernes et unifiés.",
      locationLabel: 'Siège social',
      location: 'Calgary, AB, Canada',
      foundedLabel: 'Fondation',
      founded: '2020',
      focusLabel: 'Spécialisation',
      focus: 'Systèmes d’exploitation et régulation du transport scolaire',
      showcaseTitle: 'Démonstration interactive de la console chauffeur',
      showcaseSubtitle:
        'Application mobile d’entreprise bilingue aidant les chauffeurs et accompagnateurs à accomplir leurs circuits avec sécurité et efficacité.',
      keyCapabilities: 'Capacités clés',
      driverSlides: [
        {
          id: 'checkin',
          title: 'Pointage du service',
          description: 'Pointez facilement pour les trajets planifiés avec validation GPS instantanée.',
          details:
            'Les chauffeurs effectuent leur prise de service en quelques secondes. L’application vérifie la localisation par GPS haute précision et synchronise les présences avec la console de répartition et le module de paie, éliminant les formulaires papier.',
          bullets: [
            'Validation GPS instantanée de l’emplacement',
            'Synchronisation automatique des feuilles de temps et paies',
            'Notifications d’alerte en temps réel à la régulation',
          ],
          tip: 'Conseil opérationnel : Le pointage est automatiquement recoupé avec les contrats des conseils scolaires pour garantir la conformité aux audits.',
        },
        {
          id: 'pickup',
          title: 'Embarquement des élèves',
          description: 'Suivez les heures d’arrivée en temps réel et validez les manifestes d’élèves.',
          details:
            'Les chauffeurs et accompagnateurs accèdent au manifeste d’élèves arrêt par arrêt. Un simple clic enregistre la montée et la descente de chaque élève avec l’heure réelle, assurant une traçabilité totale pour les écoles et les parents.',
          bullets: [
            'Manifeste d’élèves détaillé par arrêt',
            'Enregistrement d’embarquement d’un simple geste',
            'Suivi précis des heures d’arrivée et de départ réelles',
          ],
          tip: 'Conseil sécurité : Les fiches d’embarquement gèrent la mise en cache hors ligne dans les zones à faible connectivité.',
        },
        {
          id: 'timeoff',
          title: 'Demande de congé',
          description: 'Soumettez vos congés et suivez leur statut directement depuis l’application.',
          details:
            'Les chauffeurs demandent leurs congés (maladie, vacances, personnel) en mobilité et consultent leurs soldes. La régulation valide ou refuse les demandes, déclenchant des notifications immédiates.',
          bullets: [
            'Consultation en temps réel des soldes de congés',
            'Circuit de soumission numérique et historique complet',
            'Notifications push instantanées de validation',
          ],
          tip: 'Conseil d’efficacité : Un congé approuvé signale immédiatement le chauffeur comme indisponible sur le tableau de répartition pour désigner un remplaçant.',
        },
        {
          id: 'expense',
          title: 'Remboursement de frais',
          description: 'Photographiez vos reçus pour demander le remboursement de carburant ou d’entretien.',
          details:
            'Lors de dépenses de carburant, de lavage ou de réparations d’urgence sur la route, les chauffeurs téléversent leurs reçus en photo. La demande est transmise directement au service comptable pour rapprochement rapide.',
          bullets: [
            'Capture photo instantanée des factures et reçus',
            'Ventilation intelligente par catégorie de dépense',
            'Liaison directe avec le versement de paie',
          ],
          tip: 'Conseil financier : Prise en charge des taxes provinciales sur les carburants et génération d’états justificatifs exportables.',
        },
        {
          id: 'defect',
          title: 'Ronde de sécurité (DVIR)',
          description: 'Effectuez vos rondes de sécurité numériques et signalez les anomalies.',
          details:
            'Les rondes de sécurité avant et après départ (Schedule 5 / SAAQ / CVOR) assurent la conformité du parc. Les chauffeurs vérifient les points de contrôle (freins, feux, pneus, fluides) et joignent des photos pour alerter l’atelier mécanique.',
          bullets: [
            'Rondes de sécurité numériques conformes avant/après trajet',
            'Téléversement de photos de défectuosités mécaniques',
            'Transmission directe d’ordres de travail à l’atelier',
          ],
          tip: 'Conseil conformité : Conçu pour respecter rigoureusement les normes provinciales et fédérales de sécurité des autobus scolaires.',
        },
      ],
      valuesTitle: 'Nos engagements',
      values: [
        {
          title: 'Expertise sectorielle',
          description:
            'Compréhension opérationnelle approfondie du transport scolaire — de la planification multi-services à la conformité des chauffeurs et à la paie.',
        },
        {
          title: 'Fiabilité d’ingénierie',
          description:
            'Architecture critique conçue pour les pics quotidiens du matin et du soir, avec réactivité sub-seconde en temps réel.',
        },
        {
          title: 'Plateforme unifiée',
          description:
            'Un système d’exploitation unique reliant répartiteurs, chauffeurs, mécaniciens, RH et parents sans friction papier.',
        },
      ],
    },
    contact: {
      title: 'Prêt à moderniser vos opérations ?',
      subtitle:
        'Que vous gériez une flotte agile de 10 autobus ou un réseau régional de 500 véhicules pour un centre de services scolaire, notre équipe est prête pour des démonstrations et consultations d’architecture.',
      emailLabel: 'Courriel direct',
      locationLabel: 'Siège social',
      cta: 'Contactez-nous',
    },
    footer: {
      tagline: 'Système d’exploitation du transport scolaire · Calgary, Canada',
      copyright: 'P&CY Technical. Tous droits réservés.',
      language: 'Langue',
      links: {
        ecosystem: 'Applications',
        editions: 'Éditions',
        highlights: 'Avantages clés',
        about: 'À propos',
        contact: 'Contact',
      },
    },
  },
}
