# StockMate Documentation Index (`/docs`)

> **StockMate** is an ultra-fast, touch-first inventory and sales ledger engineered for neighborhood retail kiosks in Ethiopia.  
> This directory houses the complete engineering specifications, architectural decisions, design pack, and operations runbooks.

---

## 📁 Documentation Map

```
docs/
├── spec/               # Product requirements, domain invariants & API contracts
│   ├── SLICES.md       # Ordered vertical slices, DoR/DoD & ticket specifications
│   ├── SCOPE_SPEC.md   # User personas, core user stories, non-goals & NFRs
│   ├── INVARIANTS.md   # Inviolable architectural invariants (money, auth, concurrency)
│   └── API_SPEC.md     # Public & internal API request/response specifications
├── adr/                # Architecture Decision Records
│   ├── 0001-...md      # ADR 0001: Linking Digital Payments (Telebirr/CBE)
│   ├── 0002-...md      # ADR 0002: Phone Number + 4-digit PIN Authentication
│   └── 0003-...md      # ADR 0003: Core Technology Stack (Next.js 15, Prisma, Supabase)
├── design/             # The 8-Chapter Production Design Pack
│   ├── D1_DRIVERS.md   # Business drivers & technical constraints
│   ├── D2_SHAPE.md     # System shape, touch ergonomics & high-level architecture
│   ├── D3_BOUNDARIES.md# Module boundaries & allowed dependency directions
│   ├── D4_DATA_AND_INVARIANTS.md # Data schemas & financial consistency
│   ├── D5_INTERFACES.md# Interface signatures & API contracts
│   ├── D6_OPERATE.md   # Deployment, logging, observability & health probes
│   ├── D7_CHALLENGE.md # Threat model, concurrency races & failure modes
│   └── D8_PROTECT.md   # Automated guardrails, CI quality gates & test tiers
├── runbooks/           # Production operations & incident triage guides
│   ├── OBSERVABILITY.md# Health checks, uptime monitoring & log redaction
│   └── DEPLOYMENT.md   # Vercel + Supabase deployment & rollback procedures
├── GIT_FLOW.md         # Branching model, PR quality gates & commit conventions
└── RULES.md            # Hard rules and gotchas for contributors and AI agents
```

---

## ⚡ Quick Navigation

| Topic                                 | Primary Reference                                                                                                                      |
| :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------- |
| **Vertical Slices & Tickets Plan**    | [spec/SLICES.md](file:///c:/Users/gamme/OneDrive/Documents/Everything/Development/StockMate/docs/spec/SLICES.md)                       |
| **Domain Invariants & Money Rules**   | [spec/INVARIANTS.md](file:///c:/Users/gamme/OneDrive/Documents/Everything/Development/StockMate/docs/spec/INVARIANTS.md)               |
| **API Endpoint Contracts**            | [spec/API_SPEC.md](file:///c:/Users/gamme/OneDrive/Documents/Everything/Development/StockMate/docs/spec/API_SPEC.md)                   |
| **Git & PR Quality Gates**            | [GIT_FLOW.md](file:///c:/Users/gamme/OneDrive/Documents/Everything/Development/StockMate/docs/GIT_FLOW.md)                             |
| **Architecture Decisions**            | [adr/README.md](file:///c:/Users/gamme/OneDrive/Documents/Everything/Development/StockMate/docs/adr/README.md)                         |
| **Health Probes & Logging**           | [runbooks/OBSERVABILITY.md](file:///c:/Users/gamme/OneDrive/Documents/Everything/Development/StockMate/docs/runbooks/OBSERVABILITY.md) |
| **Production Deployment & Rollbacks** | [runbooks/DEPLOYMENT.md](file:///c:/Users/gamme/OneDrive/Documents/Everything/Development/StockMate/docs/runbooks/DEPLOYMENT.md)       |
