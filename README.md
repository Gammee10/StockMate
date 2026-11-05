# StockMate 📦

> **Ultra-fast, touch-first inventory and sales ledger for neighborhood retail counters.**

StockMate eliminates lost sales and stockouts for retail shopkeepers handling high customer volume and mixed cash/mobile payments. Designed to record sales in under 2 seconds with zero friction.

---

## ⚡ Key Highlights
- **Rush-Hour Speed:** Large 64dp+ touch targets; 1-tap cart additions and 1-tap checkout.
- **Strict Invariants:** Atomic conditional stock decrements; guaranteed zero negative inventory.
- **Mixed Payment Support:** Instant cash tracking and 1-tap digital payments (Telebirr / CBE).
- **Zero Running Cost:** Designed for \$0/month baseline deployment on Vercel + Supabase.
- **Production-Grade Architecture:** Modular monolith with strict domain boundaries, automated fitness functions, and comprehensive ADRs.

---

## 🛠️ Tech Stack
- **Framework:** [Next.js](https://nextjs.org/) (App Router, React 19)
- **Language:** TypeScript (Strict Mode)
- **Database:** PostgreSQL on [Supabase](https://supabase.com/)
- **ORM:** [Prisma](https://www.prisma.io/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/)
- **Testing:** [Vitest](https://vitest.dev/) (Unit/Integration) + [Playwright](https://playwright.dev/) (E2E)

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 20.x (tested on v24.x)
- npm >= 10.x
- PostgreSQL database (Supabase free tier or local Docker instance)

### Installation
```bash
# 1. Clone repository
git clone https://github.com/your-username/StockMate.git
cd StockMate

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# (Edit .env.local with your Supabase DATABASE_URL and JWT_SECRET)

# 4. Push database schema
npx prisma db push

# 5. Start development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the counter interface.

---

## 🧪 Testing & Quality Gates

```bash
# Run unit & invariant tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linter and architecture boundary checks
npm run lint

# Run TypeScript strict type verification
npm run typecheck
```

---

## 📚 Architecture & Documentation

All design decisions, specifications, and operational playbooks are maintained in the [`docs/`](docs/) directory:

- [10-Stage Workflow & Working Rules](docs/WORKFLOW.md)
- [Stage 2: Problem Brief](docs/PROBLEM_BRIEF.md)
- [Stage 4: Scope & Non-Goals](docs/STAGE4_SCOPE_SPEC.md)
- [Stage 5: Technical Discovery & Spikes](docs/STAGE5_TECH_DISCOVERY.md)
- [Stage 6: Design Pack Master Index](docs/STAGE6_DESIGN_PACK.md)
  - [D1. Drivers & Quality Targets](docs/design/D1_DRIVERS.md)
  - [D2. Shape & Container Diagrams](docs/design/D2_SHAPE.md)
  - [D3. Boundaries & Module Ownership](docs/design/D3_BOUNDARIES.md)
  - [D4. Data & Invariants](docs/design/D4_DATA_AND_INVARIANTS.md)
  - [D5. API Interfaces & Contracts](docs/design/D5_INTERFACES.md)
  - [D6. Operate & Runbook Stubs](docs/design/D6_OPERATE.md)
  - [D7. Challenge & Threat Model](docs/design/D7_CHALLENGE.md)
  - [D8. Protect & Fitness Functions](docs/design/D8_PROTECT.md)
- [Architectural Decision Records (ADRs)](docs/adr/README.md)
- [Coding & Architectural Rules](docs/RULES.md)

---

## 📄 License
MIT License. Free to use, adapt, and build upon.
