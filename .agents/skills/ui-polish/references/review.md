# Review checklist

Do this after `npm run ui:check` passes. The checker finds known bad patterns. It cannot tell you if the screen is clear and well balanced. This list does.

## 1. Look at it

If you can see images, take screenshots (needs the dev server running and a page that does not need a login):

```bash
npx playwright install chromium     # once
mkdir -p .ui-shots
npx playwright screenshot --full-page --viewport-size="1280,800" http://localhost:3000/ROUTE .ui-shots/route-desktop.png
npx playwright screenshot --full-page --viewport-size="390,844"  http://localhost:3000/ROUTE .ui-shots/route-mobile.png
npx playwright screenshot --full-page --viewport-size="1280,800" --color-scheme=dark http://localhost:3000/ROUTE .ui-shots/route-dark.png
```

Add `.ui-shots/` to `.gitignore`. Open each image and look at it. The dark shot only differs if the app follows the system theme.

If you cannot see images, or the page needs a login, say so in your report. The user can send screenshots to a stronger model for a design review.

## 2. Check each item

Answer yes or no. Fix every "no".

**Hierarchy**
- [ ] I can say in one sentence what the main thing on this screen is.
- [ ] There is one main button. It stands out. Other buttons are quieter.
- [ ] The page title is the biggest text. Body text is `text-sm`.

**Spacing and alignment**
- [ ] Related things are closer together than unrelated things.
- [ ] All left edges line up. There are no odd gaps.
- [ ] Spacing uses the steps from `SKILL.md`. No `p-[13px]`.
- [ ] The page uses the same container as the other pages.

**Color and surfaces**
- [ ] Almost everything is neutral. The accent color appears only on the main action, links and focus.
- [ ] No gradients, glow, emoji or heavy shadows.
- [ ] No card inside a card. Not every section is a card.
- [ ] No icon in a colored circle. No single accent-colored word in a heading.
- [ ] No small all-caps label above a heading.

**Text**
- [ ] Sentence case. Short labels. No marketing filler.
- [ ] Numbers use `tabular-nums` and number columns are right-aligned.
- [ ] Long text cannot break the layout (use `truncate` or let it wrap on purpose).
- [ ] Data looks real: believable names, dates and amounts.

**States**
- [ ] Loading state exists and has the same shape as the page.
- [ ] Empty state exists: one sentence and one action.
- [ ] Error state exists and says how to fix it.
- [ ] Forms: labels above, help text below, error text under the field.
- [ ] Buttons look right when disabled and while saving.

**Responsive**
- [ ] At 390px wide: no sideways scroll, nothing cut off, buttons are easy to tap.
- [ ] At 390px wide, a table shows the main cell and one or two short columns. The rest are hidden below `sm`, and their values sit under the main cell.
- [ ] Cards in a row line up: the same title height, and buttons at the same level.
- [ ] At 1280px wide: content does not stretch across the whole screen.

**Dark mode (if the app has it)**
- [ ] Text is readable. Borders are visible. No bright white boxes.

**Accessibility basics**
- [ ] Every input has a label. Icon-only buttons have `aria-label`.
- [ ] Focus ring is visible when you press Tab.
- [ ] Actions are `<Button>`, navigation is `<Link>`.

## 3. Report

Keep it short:

- What you changed (one line per screen).
- Checker result (PASS, plus any WARN you left and why).
- What you could not check (for example: no screenshots, dark mode not tested).
