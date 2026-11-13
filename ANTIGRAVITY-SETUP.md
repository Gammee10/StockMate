# Use the two skills in Google Antigravity

This bundle holds the `ui-polish` and `backend-solid` skills, already placed where Antigravity looks for them. It was checked against the official Antigravity docs in November 2026. Antigravity changes often, so see "If something does not match" at the end.

```
your-project/
  AGENTS.md                      <- always-on rules (step 2)
  .agents/skills/ui-polish/      <- skill 1
  .agents/skills/backend-solid/  <- skill 2
```

## How Antigravity uses a skill

- Each turn, the agent sees the name and description of every skill. If one looks relevant, it reads the full `SKILL.md` and follows it.
- You can also call a skill yourself. In the Antigravity app, type `/ui-polish` or `/backend-solid` at the start of a task. In other places, write the skill name in your prompt.
- Antigravity reads `AGENTS.md` at the project root on every turn. This is the file that makes a smaller model follow the skills. Do not skip step 2.

A lighter model like Gemini Flash can skip a skill when it decides on its own. So the setup uses three layers: the description (automatic), `AGENTS.md` (always on), and the check scripts (a hard test at the end).

## 1. Put the skills in the project

Unzip this bundle into the root of your project. You need the hidden folder `.agents`. Check that these files exist:

```
.agents/skills/ui-polish/SKILL.md
.agents/skills/backend-solid/SKILL.md
```

If your Antigravity is old and does not see them, rename `.agents` to `.agent`. Antigravity still supports that name. Then change `.agents` to `.agent` in steps 2 to 4.

## 2. Add the rules to AGENTS.md

Add the text from `AGENTS.add.md` to the `AGENTS.md` file in your project root. If you do not have one yet, this creates it:

```bash
cat AGENTS.add.md >> AGENTS.md
```

On Windows, open both files and copy the text by hand. `AGENTS.md` needs no special header. It is only about 1.5 KB. Antigravity cuts a rule file above 24,000 bytes, so there is plenty of room. Keep it short anyway. A short rule is followed more often than a long one.

## 3. Add the scripts to package.json

```json
"scripts": {
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "backend:check": "node .agents/skills/backend-solid/scripts/check-backend.mjs",
  "ui:check": "node .agents/skills/ui-polish/scripts/check-ui.mjs"
}
```

Keep the scripts you already have.

## 4. Tell ESLint to ignore the skills

The skill folders contain example `.ts` files. `tsc` and `next build` skip folders that start with a dot. ESLint does not. In `eslint.config.mjs`:

```js
globalIgnores([".agents/**"])
```

## 5. One-time setup (let the model do it)

Save your work in git first. Then open a new chat in Antigravity and write:

> /backend-solid Follow `.agents/skills/backend-solid/references/setup.md` and set up the project. Tell me what you changed.

When that is done, in a new chat:

> /ui-polish Follow `.agents/skills/ui-polish/references/setup.md` and set up the project. Tell me what you changed.

Start a new chat after you add or change a skill. A running chat may not see it.

## 6. Check that the model sees the skills

In a new chat, ask: **"What skills are available?"** It should list `ui-polish` and `backend-solid`. If not, see "If something does not match".

## 7. The daily loop

1. Ask for one feature. Name the skill if the model is not using it: "Use the backend-solid skill. Add ...".
2. The model reads the skill, writes the code, and runs the checks.
3. You run the checks yourself. Never trust "I ran them":
   ```bash
   npm run typecheck && npm test && npm run backend:check && npm run ui:check
   ```
4. If anything says FAIL, paste the whole output into the chat: "Fix every FAIL. Do not use an ignore comment unless there is a real reason, and tell me about each one."
5. Look at the page in the browser. The checker finds known "AI look" patterns. It cannot judge taste.

Handy commands (the model can run these too):

```bash
npm run backend:check -- --changed      # only files changed in git
npm run backend:check -- app/api/orders # one folder
npm run ui:check -- --changed
```

## 8. Fix the existing app

Run `npm run backend:check` and `npm run ui:check` once and read the lists. Then ask the model to fix them one feature or one page at a time, not all at once. Backend order: committed secrets, missing auth and owner filters, input validation, transactions and "once only", error leaks, the rest. A secret that was ever in git is leaked. Rotate the key.

## 9. Use a stronger model once

Do this one time, not every task. Switch to a stronger model and ask it to review the auth setup (`server/auth.ts`), the database schema, and the first service and route built with the skill. Do the same for the first two pages in the UI. After that, the smaller model copies a good base.

## If the model ignores the skill

- Start the task with `/backend-solid` or `/ui-polish`, or write the name in the prompt.
- Make the task smaller. One feature per chat.
- Open a new chat. Long chats make small models forget the rules.
- Paste the checker output back. The check is the part that does not depend on the model's memory.

## If something does not match

Antigravity is new and its folders and commands have changed more than once. The official docs are the source of truth:

- Skills: https://antigravity.google/docs/skills
- Rules and AGENTS.md: https://antigravity.google/docs/rules
- Codelab: https://codelabs.developers.google.com/getting-started-with-antigravity-skills

## Limits

- I tested both skills with Claude Haiku 5.5, not with Gemini Flash. A weaker model may need more steps than the guide above shows.
- The checkers are a net. They find known patterns and miss others. Tests and review are still needed.
- Skills are written for Next.js App Router, Tailwind v4 and shadcn/ui (UI), and Next.js 16 with Postgres, Drizzle or Prisma 7 (backend).
- Two backend limits matter most. The owner-filter check cannot tell where an id comes from (a human or stronger model should check that the user id comes from the session). The default rate limiter works in one server process only, so on a host with several instances use a shared store.
