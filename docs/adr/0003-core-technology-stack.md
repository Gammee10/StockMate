# ADR 0003: Core Technology Stack

## Status
Accepted (Stage 5)

## Context
StockMate requires an ultra-responsive web user interface, ACID transactional database consistency for inventory protection, zero hosting costs, and high resume appeal for a software engineering portfolio.

## Alternatives Considered
1. **Next.js (App Router, TypeScript) + Prisma ORM + PostgreSQL + Tailwind CSS**
2. **Decoupled React (Vite) + Node.js (Express) + PostgreSQL**
3. **Python (FastAPI) + React (Vite) + PostgreSQL**

## Decision
Adopt **Alternative 1: Next.js (App Router, TypeScript) + Prisma ORM + PostgreSQL + Tailwind CSS**.

### Rationale
- **End-to-End Type Safety:** Zero drift between database schema, API handlers, and React components.
- **Zero Cold-Start Sleep:** Vercel edge/serverless execution avoids the 30–50 second container spin-up delays inherent in free-tier container platforms (Render, Koyeb).
- **Strongest Portfolio Relevance:** Demonstrates mastery of the industry standard web architecture.

## Consequences
- Requires clear discipline separating Server Actions / Route Handlers from interactive Client Components (`'use client'`).
- Strict schema migrations managed reliably via Prisma Migrate.
