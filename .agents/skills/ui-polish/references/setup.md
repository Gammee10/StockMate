# One-time setup

Do these steps once per project. Skip any step that is already done. Tell the user what you changed.

## 1. Check what exists

Read `package.json` and look for:

- `next` (App Router is expected: an `app/` folder).
- `tailwindcss` version. This skill needs **Tailwind v4** (the CSS file starts with `@import "tailwindcss"`). If the project is on Tailwind v3, stop and ask the user. The official upgrade tool is `npx @tailwindcss/upgrade` (needs Node 20+). Do not mix v3 and v4 code.
- `components.json` and a `components/ui/` folder. These mean shadcn/ui is already installed.

Make sure the work is saved in git before you change config files.

## 2. Install shadcn/ui (only if `components.json` is missing)

```bash
npx shadcn@latest init -d
```

`-d` means "use defaults and ask nothing". Without it the command waits for keyboard input and gets stuck. The old flags `--style`, `--base-color` and `--css-variables` were removed in CLI v4 and will error. Do not use them.

If the user gave you a preset code (from ui.shadcn.com/create), run `npx shadcn@latest init --preset <code>` instead. Then skip step 4, because a preset brings its own colors.

## 3. Add the components

```bash
npx shadcn@latest add button input textarea label select checkbox switch card badge table tabs dialog dropdown-menu sheet separator skeleton sonner avatar tooltip empty spinner sidebar breadcrumb
```

If one name fails, skip it and add the rest. Do not run `add --all`. It adds components nobody uses.

To see what a component or block will add before you install it: `npx shadcn@latest view <name>`.
To see how to use a component: `npx shadcn@latest docs <name>`.

## 4. Install the color tokens

Open `references/tokens.css` (next to this file). Copy all of it to the **end** of `app/globals.css` (or `src/app/globals.css`). Do not delete anything that is already there.

Check it worked:

```bash
grep -n "\-\-success" app/globals.css
```

You should see `--success` in `:root`, in `.dark` and as `--color-success` in `@theme inline`.

To change the brand color, follow the "READY-MADE ACCENTS" note at the bottom of `tokens.css`.

## 5. Check the font

`create-next-app` already sets up Geist in `app/layout.tsx`. Check that it looks like this. Only add what is missing.

```tsx
import { Geist, Geist_Mono } from "next/font/google"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

// <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
```

And `globals.css` must map them inside `@theme inline`:

```css
--font-sans: var(--font-geist-sans);
--font-mono: var(--font-geist-mono);
```

Use one font family for the whole app. Do not add a second one unless the user asks.

## 6. Dark mode (only if the user wants it)

```bash
npm install next-themes
```

Wrap the app in `ThemeProvider` with `attribute="class"` and `defaultTheme="system"`. Add `suppressHydrationWarning` to the `<html>` tag. The tokens already have `.dark` values.

## 7. Add the check script

In `package.json`, add this to `scripts`. Change the path if the skill lives somewhere else.

```json
"ui:check": "node .agents/skills/ui-polish/scripts/check-ui.mjs"
```

Then run `npm run ui:check`. It should not say "SETUP NEEDED".

## 8. Remove the starter page

If `app/page.tsx` still has the default Next.js welcome page (logos, "Get started by editing"), replace it with a real page. Delete unused starter images in `public/`.

## 9. Confirm

```bash
npm run ui:check
npx tsc --noEmit
```

Fix anything that breaks. Then go back to `SKILL.md` step 2.
