---
name: ui-polish
description: Required for ANY task that creates or changes UI in this Next.js app: pages, layouts, components, forms, tables, dashboards, landing pages, empty or loading states, or fixing how something looks. Gives design rules, copy-paste page patterns and a checker script so the result looks like a real, well-made product and not like generic AI output. Use it even for small styling changes.
---

# UI polish

Goal: UI that looks like a real, well-made product. Not generic AI output.

You are not here to invent a style. The style already exists in this project: the color tokens, the `components/ui` folder and the patterns in this skill. Build with them. When you are unsure, choose the plainer option. Plain and consistent beats clever and messy.

## Workflow

Follow these steps in order.

1. **Check the foundation.** Run `npm run ui:check`. If it says "SETUP NEEDED" or the script is missing, do `references/setup.md` first.
2. **Look before you build.** Open two existing pages or components that are close to what you are building. Match them. Before you use a component, read `components/ui/<name>.tsx` to see its real props and variants. Do not guess props.
3. **Pick a pattern.** Open `references/patterns.md` and copy the closest one. Change the content, keep the structure. For a full app shell, login page or dashboard, install a shadcn block instead of writing one. Run `npx shadcn@latest view sidebar-07` to see what it adds, then `npx shadcn@latest add sidebar-07`. Other good blocks: `login-04`, `dashboard-01`. Do not overwrite files that already exist.
4. **Write real content.** Real labels, realistic data, short plain copy.
5. **Build** with the rules below.
6. **Run `npm run ui:check`.** Fix every FAIL. Fix every WARN too, unless you have a clear reason. Do not say you are done while a FAIL remains.
7. **Review** with `references/review.md`.
8. **Report** in a few lines: what you changed, and what you could not check.

## Rules

These rules exist because most "AI look" comes from inconsistency: many colors, many sizes, many radii. A small fixed set looks designed.

### Color
- Use tokens only: `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border` (or just `border`), `bg-primary text-primary-foreground`.
- Status: `text-success`, `text-warning`, `text-destructive`, and soft fills like `bg-success/10`.
- Never use palette colors (`bg-blue-500`, `text-gray-600`) or hex values in components.
- Never write `dark:` color classes. The tokens already switch in dark mode.
- The accent (`primary`) is for the one main action per view, links and focus. Everything else is neutral.
- No gradients. No glow. No glass or blur effects, except `bg-background/80 backdrop-blur` on a sticky header.
- Need a new color? Add a token in `globals.css` (`:root`, `.dark` and `@theme inline`). Never put a raw color in a component.

### Type
- One font family (`font-sans`). Use `font-mono` only for code and IDs.
- Use only this scale:
  - Page title: `text-2xl font-semibold tracking-tight`
  - Section title: `text-base font-semibold`
  - Body and UI: `text-sm`
  - Secondary text: `text-sm text-muted-foreground`
  - Small meta: `text-xs text-muted-foreground`
  - Landing page only: hero `text-4xl sm:text-5xl`, section headings `text-3xl`, prices `text-4xl tabular-nums`. All with `font-semibold tracking-tight`, and `text-balance` on headings
- Weights: `font-normal`, `font-medium`, `font-semibold`. Never `font-bold`.
- Numbers in tables and stats: `tabular-nums`. In tables, right-align number columns.
- Use sentence case everywhere ("Save changes", not "Save Changes").

### Space and layout
- Use these spacing steps: 1, 2, 3, 4, 6, 8, 12, 16, 24. Avoid 5, 7, 9, 10, 11 and values like `p-[13px]`.
- Page container: `mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8`. Space between sections: `space-y-8`. Between form fields: `space-y-4`. Label to input: `space-y-2`. Related items: `gap-2`.
- Group related things close together. Put more space between groups than inside them.
- Left-align text. Center only: auth cards, empty states, one landing heading.
- Limit line length: reading text `max-w-prose`, forms `max-w-xl`.
- Build mobile first. Stack on small screens (`flex-col`), then use `sm:`, `md:`, `lg:` to go wide. Keep buttons and inputs at their default size. Do not shrink them to make things fit.
- A table must not scroll sideways on a phone. Below `sm`, show the main cell (with a second line of small muted text under it) and one or two short columns, such as status or amount. If the main cell has an avatar or an email, show only one more column, because those are wide. Hide the other columns with `hidden sm:table-cell` on the `TableHead` and on every `TableCell` of that column, and show their values in the main cell's second line, as in the data table pattern. The checker warns when too many columns are visible.

### Surfaces
- Radius: `rounded-md` for controls (buttons, inputs). `rounded-xl` for panels, the same as `<Card>` (check `components/ui/card.tsx`), so hand-built panels and cards match. `rounded-full` only for avatars and pills. Never `rounded-2xl` or `rounded-3xl`.
- Use borders, not shadows. Never go above `shadow-sm` on cards or sections. Menus, popovers and dialogs already have their own shadow.
- Do not put a card inside a card. Do not wrap every section in a card. Try whitespace and a heading first. Use a card for one distinct object: a record, a plan, a form section.

### Components
- Use `components/ui/*` for buttons, inputs, selects, checkboxes, switches, dialogs, menus, tables, tabs, badges, cards, skeletons, toasts. Never hand-style a raw `<button>`, `<input>`, `<select>` or `<table>`.
- Do not edit `components/ui/*` for a one-off look. Use `className` at the call site.
- Icons: `lucide-react` only. Use `size-4` in buttons, inputs and lists. `size-5` at most. Icons are plain (`text-muted-foreground`). No emoji. No icon inside a colored (primary, success, warning ...) circle or square. A neutral square (`border bg-background` or `bg-muted`) is fine, as in the landing page pattern and shadcn's `Empty` component.
- Buttons: one `default` button per view. Others are `outline` or `ghost`. `destructive` only for destructive actions. Icon-only buttons need an `aria-label`.
- Badges: only for status. One per row at most.
- Actions use `<Button>`. Navigation uses `<Link>`. Never a clickable `<div>`.
- Do not add other UI libraries, icon sets or CSS files.

### States
A screen is not done until it has all of these:
- **Loading:** `<Skeleton>` blocks with the same shape as the final content (a `loading.tsx` file for routes).
- **Empty:** one short sentence and one action. See the empty-state pattern.
- **Error:** say what went wrong and how to fix it. Offer a retry.
- **Form errors:** text under the field in `text-sm text-destructive`, plus `aria-invalid` on the input.
- Keep the focus ring. Never remove the outline.

### Motion
- Only `transition-colors` or `transition-opacity`. No `transition-all`, no `hover:scale-*`, no hover lift, no bounce, ping or pulse.
- No entrance animation on every section. Motion should answer a click or show a change.

### Copy
- Plain, short, specific. "Invite member", "No invoices yet", "Payment failed. Check the card number."
- No "Welcome to", "Supercharge", "Seamless", "Unlock", "Elevate", "Effortless", no exclamation marks in app UI.
- Real-looking data: believable names, dates and amounts. Format with `Intl.NumberFormat` and `Intl.DateTimeFormat`.
- Do not invent stats, testimonials or customer logos. Leave them out.

## Looks like AI? Replace it.

| If you wrote this | Write this instead |
|---|---|
| Purple or blue gradient on a hero or button | Solid `bg-primary`. No gradient |
| Gradient text | `text-foreground`. Show emphasis with size or weight |
| Emoji as icons or in headings | A `lucide-react` icon, or nothing |
| Every section in a `rounded-2xl shadow-lg` card | One `border` card only where grouping helps. Otherwise whitespace and a heading |
| Four identical stat cards with colored icons and green "+12%" pills | The stats row pattern: label, number, short muted note |
| Three-column feature grid with icon circles | A plain list or table with real details |
| Centered hero: "Welcome to X" / "Supercharge your workflow" | Left-aligned headline that says what the product does, one main button, one secondary |
| `hover:scale-105`, bouncing, fade-in on everything | `transition-colors` only |
| `text-gray-400`, `bg-slate-50` | `text-muted-foreground`, `bg-muted` |
| `font-bold` on every heading | `font-semibold` and a size from the scale |
| One word of the headline in the accent color | One color for the whole headline |
| Small ALL-CAPS label above every heading | No label, or sentence-case `text-sm text-muted-foreground` |
| A badge on every item | A badge only for real status |
| "JD" avatars, "John Doe", lorem ipsum | Real-looking names, or no avatar |

## Marketing and landing pages

Use pattern 10 in `references/patterns.md`. App screens are quiet. A landing page can have more presence, but spend the boldness in only two places: the large plain hero headline, and one closing band in the accent color (`bg-primary text-primary-foreground`). Show the real product in the hero (a card built from the same components), not a stock picture. Separate sections with `border-y bg-muted/40` bands. Everything else stays plain. Do not invent logos, numbers or testimonials.

## Fixing an existing screen

1. Run `npm run ui:check -- app/the-route` to get the list of problems.
2. Fix in this order: layout and shell, then shared components, then the page itself.
3. Swap raw `<button>`, `<input>`, `<table>` for `components/ui`. Swap colors for tokens. Remove gradients, emoji and shadows. Bring text and spacing back to the scales above.
4. Add the missing loading, empty and error states.
5. Change only UI code. Do not touch data fetching, routes or logic unless asked.
6. Work one screen at a time. Run the checker after each one. Use `npm run ui:check -- --changed` to check only files you changed.

## When someone asks for something special

Keep every rule and add one idea only. For example: very large type, one real photo, or a subtle pattern in `bg-muted`. If the user clearly asks for something the checker blocks (a gradient, say), do it, and put `ui-check-ignore` in a comment on that line so the checker skips it.

## More help

- `references/patterns.md`: copy-paste page patterns.
- `references/review.md`: self-review checklist and screenshot commands.
- `references/setup.md`: one-time setup (shadcn/ui, tokens, fonts, check script).
- `npx shadcn@latest docs <component>`: shows usage and examples for any shadcn component.
