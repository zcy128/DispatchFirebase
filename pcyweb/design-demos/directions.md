# Design Directions · Dispatch OS Official Web

## Design Spec (Common Input)
- **Project**: P&CY Technical Dispatch OS — Student Transportation Operating System (Système d'exploitation du transport scolaire)
- **Audience**: School bus fleet operators, dispatch managers, municipal school boards / school districts, fleet mechanics, bus drivers, and student parents.
- **Key Modules**:
  1. Three Connected Apps: Dispatch Office Console (Desktop/PWA), Driver & Monitor App (Mobile PWA), Parent Bus Tracker Portal (Family Bento).
  2. Two Scalable Editions: Cloud Edition (Firebase Serverless, zero maintenance) vs. Enterprise Edition (.NET 10 + MySQL/SQL Server, SignalR, Quartz.NET).
  3. Seven Operational Pillars: 3-Run daily structure, student-level stop accuracy, shift-linked payroll engine, vehicle defect quarantine, sub-second live push, automated cover shifts, 13-role security matrix.
  4. Live Interactive Demo Access: 1-click test credentials for both Cloud (Firebase) and Enterprise (.NET).
- **Languages**: English & French (EN / FR) bilingual.
- **Viewport Target**: Responsive Web (Desktop 1440px / Mobile 375px).

---

## 6 Candidate Cards

### 1. Best Designer Candidate 1 (Selected as Direction 1)
- **Logic & Source**: Jony Ive / Apple Keynote Pro & Mission-Control Operations Hub
- **Borrowed Elements**: Deep obsidian black-blue background (`#070B14`), school bus chrome yellow high-contrast accent (`#F59E0B` / `#FACC15`), glowing frosted glass panels (`backdrop-blur-xl`), 16:9 hero console mockup with real-time status pulses, hardware precision.
- **Hero Material**: High-fidelity central Dispatch Console with live shift status pills, driver check-in dots, and interactive demo credentials.
- **Skeleton Layout**: Immersive dark hero stage -> 3-device live sync radiation -> side-by-side architecture spec cards -> terminal/API live demo cards.
- **Bold Move**: Placing an interactive Mission-Control simulation console directly inside the hero section.
- **Form Origin**: Morning and afternoon school bus rollouts are zero-error launch windows; the site feels like an air traffic control desk.

### 2. Best Designer Candidate 2 (Reserve)
- **Logic & Source**: Massimo Vignelli / Pentagram — Swiss Transport & Transit Topology
- **Borrowed Elements**: High-density 12-column Swiss grid, severe geometric sans typography, transit route maps with colored interchange dots, stark white & black contrast with traffic signal colors.
- **Hero Material**: Geometric route network diagram with stop sequence markers.
- **Skeleton Layout**: Left sticky transit timeline index, right modular high-density specification tables.
- **Bold Move**: Treating school bus routes like an official municipal subway transit map.
- **Form Origin**: Route sheets and stop rosters are essentially urban transit lines.

### 3. Real-World Reference Candidate 1 (Selected as Direction 2)
- **Logic & Source**: Stripe & Vercel Enterprise — High-Trust Architectural White Gallery
- **Borrowed Elements**: Crisp porcelain-white canvas (`#FFFFFF` / `#F8FAFC`), subtle ambient cyan/amber glow, ultra-refined 1px border dividers, structured 2-column feature breakdown, prominent architecture comparison matrix.
- **Hero Material**: Clean floating browser frames with crisp vector typography and explicit architectural diagrams.
- **Skeleton Layout**: Light, airy, executive SaaS presentation -> interactive 3-app tab switcher -> Cloud vs. Enterprise side-by-side checklist -> security/compliance badges.
- **Bold Move**: Hyper-clean, high-density architecture comparison table with zero fluff, proving enterprise credibility.
- **Form Origin**: School district superintendents and CFOs require strict compliance, clear audit trails, and zero ambiguity.

### 4. Real-World Reference Candidate 2 (Reserve)
- **Logic & Source**: Linear.app — Dark Engineering & Keyboard-First Ops
- **Borrowed Elements**: Pitch-black canvas (`#08090A`), purple-blue gradient ambient lighting, hairline dividers, micro-status tags, developer-friendly keyboard shortcuts.
- **Hero Material**: Dark theme kanban boards with sub-second synchronization badges.
- **Skeleton Layout**: Vertical command-center flow with floating bento modules.
- **Bold Move**: Emphasizing sub-second latency and zero-lag hot reloading.
- **Form Origin**: Dispatchers need lightning-fast operations during morning rush hours.

### 5. Style Roulette Candidate 1 (Selected as Direction 3)
- **Logic & Source**: Style #13 Glassmorphism Bento + User Historical Preference (L1/L2: Direction C Family Bento, deep blue `#0F172A`, 28px rounded corners, comforting warm palette).
- **Borrowed Elements**: Deep slate blue (`#0B132B` / `#0F172A`), rounded 28px bento cards, school bus yellow highlights (`#FBBF24`), calming dark UI, parent-centric peace of mind.
- **Hero Material**: Live Family Bento tracking preview with `< 2 MINS AWAY` arrival countdown and driver check-in badge.
- **Skeleton Layout**: Bento grid mosaic with cards of varying sizes (live map card, driver punch card, payroll gauge card, dual edition toggle card).
- **Bold Move**: Reframing dispatch operations as a compassionate "Safe Journey Guardian" rather than cold machinery.
- **Form Origin**: Every school bus seat holds a child; safety and family peace of mind are the core purpose of the system.

### 6. Style Roulette Candidate 2 (Reserve)
- **Logic & Source**: Style #15 Utility-First Colorful Docs
- **Borrowed Elements**: Slate background with rainbow colored category tabs for Driver, Parent, Dispatch, and Developer MCP.
- **Hero Material**: Interactive documentation workbench with runnable code snippets.
- **Skeleton Layout**: Three-column documentation style layout.
- **Bold Move**: Presenting the operating system like an open developer API and workflow platform.
- **Form Origin**: The platform provides MCP endpoints and Go microservice APIs.

---

## The 3 Chosen Directions for Full Prototype Build
1. **Direction 1 (dir-1.html)**: **Mission-Control Operations Hub** (Dark Obsidian + School Bus Yellow + 16:9 Live Ops Cockpit)
2. **Direction 2 (dir-2.html)**: **Modern High-Trust Enterprise** (Crisp Porcelain White + Precision Grid + Architecture Comparison Matrix)
3. **Direction 3 (dir-3.html)**: **Family Bento Warm Guardian** (Deep Navy + 28px Rounded Bento Grid + Compassionate Safety Focus)
