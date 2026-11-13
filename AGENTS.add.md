
## UI work
Before you write or change any UI (pages, components, styling), read and follow `.agents/skills/ui-polish/SKILL.md`.
After UI changes, run `npm run ui:check` and fix every FAIL before you finish.
Use color tokens and `components/ui`. Never use raw Tailwind palette colors, gradients or emoji icons.

## Backend work
Before you write or change any backend code (API routes, server actions, database, auth, webhooks, env vars), read and follow `.agents/skills/backend-solid/SKILL.md`.
After backend changes, run `npm run typecheck`, `npm test` and `npm run backend:check`, and fix every FAIL before you finish.
Every route handler and server action uses a helper from `server/api.ts` or `server/action.ts`. Every query on user data filters by the owner. Never write your own auth. Never put a secret in code.
