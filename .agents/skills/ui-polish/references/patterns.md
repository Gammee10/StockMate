# Page patterns

Copy the closest pattern. Change the content, keep the structure. Every pattern already follows the rules in `SKILL.md`.

Before you copy:

- Check the real props in `components/ui/<name>.tsx`. Some props depend on the library under shadcn/ui (Radix uses `asChild`, Base UI uses `render`). Match what the existing code in the project does.
- Names like `rows`, `user`, `invoice` and `saveProfile` stand for your own data and actions.
- For the app shell (sidebar and top bar), a login page or a dashboard, install a shadcn block instead of writing it: `sidebar-07`, `login-04`, `dashboard-01`.

Patterns: 1 Page header, 2 Page layout, 3 Stats row, 4 Status badge, 5 Data table, 6 Empty state, 7 Loading state, 8 Settings form, 9 Detail page, 10 Landing page, 11 Sign-in page, then short notes on charts, dialogs and toasts.

---

## 1. Page header

Put this at the top of every page. Same title size, same spacing, same place for actions.

```tsx
// components/page-header.tsx
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
```

## 2. Page layout

One container for every page. One main button in the header.

```tsx
// app/invoices/page.tsx
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { StatsRow } from "@/components/stats-row"
import { InvoicesTable } from "@/components/invoices-table"

export default function InvoicesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Invoices"
        description="Track what you have sent and what has been paid."
        actions={<Button>New invoice</Button>}
      />
      <StatsRow />
      <InvoicesTable rows={rows} />
    </div>
  )
}
```

If the app uses a sidebar block, the layout may already add the container and padding. Look at the layout file first.

## 3. Stats row

Label, number, one short note. No icons. No colored pills. If you show a change, make it plain text and only if it is real: `text-success` or `text-destructive`.

```tsx
// components/stats-row.tsx
const stats = [
  { label: "Outstanding", value: "$12,480", note: "6 invoices due this week" },
  { label: "Paid this month", value: "$8,230", note: "14 invoices" },
  { label: "Overdue", value: "$1,150", note: "2 invoices" },
  { label: "Average days to pay", value: "11", note: "Down from 14 last month" },
]

export function StatsRow() {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl border bg-card p-4">
          <dt className="text-sm text-muted-foreground">{stat.label}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{stat.value}</dd>
          <dd className="mt-1 text-xs text-muted-foreground">{stat.note}</dd>
        </div>
      ))}
    </dl>
  )
}
```

## 4. Status badge

The only place for a colored badge. A light tint, a thin border, colored text. One badge per row.

```tsx
// components/status-badge.tsx
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const styles = {
  paid: "border-success/30 bg-success/10 text-success",
  pending: "border-warning/30 bg-warning/10 text-warning",
  overdue: "border-destructive/30 bg-destructive/10 text-destructive",
  draft: "text-muted-foreground",
} as const

export type Status = keyof typeof styles

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant="outline" className={cn("capitalize", styles[status])}>
      {status}
    </Badge>
  )
}
```

## 5. Data table

Search on the left, main action on the right. Numbers right-aligned. One actions menu per row. A bordered wrapper, no extra card. Handles the empty case. On phones the customer name moves under the invoice number (`hidden sm:table-cell`), so the table never scrolls sideways. Copy this idea for your own tables: hide the least important column on small screens and show its value under the main cell. The `[&_tr>*:first-child]:pl-4` classes on `<Table>` give the first and last cells more room next to the border.

```tsx
// components/invoices-table.tsx
import { MoreHorizontal } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge, type Status } from "@/components/status-badge"
import { InvoicesEmpty } from "@/components/invoices-empty"

type Invoice = {
  id: string
  number: string
  customer: string
  status: Status
  amount: number
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export function InvoicesTable({ rows }: { rows: Invoice[] }) {
  if (rows.length === 0) return <InvoicesEmpty />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input placeholder="Search invoices" className="sm:max-w-xs" />
        <Button variant="outline" className="ml-auto">
          Export
        </Button>
      </div>
      <div className="rounded-xl border">
        <Table className="[&_tr>*:first-child]:pl-4 [&_tr>*:last-child]:pr-4">
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead className="hidden sm:table-cell">Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.number}
                  <div className="text-xs font-normal text-muted-foreground sm:hidden">
                    {row.customer}
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{row.customer}</TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {currency.format(row.amount)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className={buttonVariants({ variant: "ghost", size: "icon" })}
                      aria-label={`Actions for ${row.number}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View</DropdownMenuItem>
                      <DropdownMenuItem>Download PDF</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

## 6. Empty state

One short sentence about what is missing, and one action. No big illustration, no cheerful emoji.

```tsx
// components/invoices-empty.tsx
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export function InvoicesEmpty() {
  return (
    <Empty className="rounded-xl border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileText />
        </EmptyMedia>
        <EmptyTitle>No invoices yet</EmptyTitle>
        <EmptyDescription>
          Create your first invoice to start tracking payments.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button>New invoice</Button>
      </EmptyContent>
    </Empty>
  )
}
```

If `components/ui/empty.tsx` does not exist, run `npx shadcn@latest add empty`. Or use this plain version:

```tsx
// components/invoices-empty.tsx (plain version)
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

export function InvoicesEmpty() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-12 text-center">
      <FileText className="size-6 text-muted-foreground" />
      <div className="space-y-1">
        <p className="font-medium">No invoices yet</p>
        <p className="text-sm text-muted-foreground">
          Create your first invoice to start tracking payments.
        </p>
      </div>
      <Button>New invoice</Button>
    </div>
  )
}
```

## 7. Loading state

Skeletons with the same shape and the same container as the real page. In Next.js, put this in `loading.tsx` next to `page.tsx`.

```tsx
// app/invoices/loading.tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="rounded-xl border">
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

For a button that is saving: disable it and show `<Spinner />` before the label (`npx shadcn@latest add spinner`).

## 8. Settings form

Section title and help text on the left, fields on the right. Label above the input. Help text under it. Errors under it in red. Cancel and Save at the bottom right.

```tsx
// app/settings/page.tsx
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/page-header"

// user, errors and saveProfile come from your own code.
export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Settings"
        description="Manage your profile and notifications."
      />

      <section className="grid gap-6 md:grid-cols-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Profile</h2>
          <p className="text-sm text-muted-foreground">
            How your name appears to teammates.
          </p>
        </div>
        <form action={saveProfile} className="space-y-4 md:col-span-2">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={user.name}
              aria-invalid={Boolean(errors?.name)}
              aria-describedby={errors?.name ? "name-error" : undefined}
            />
            {errors?.name ? (
              <p id="name-error" className="text-sm text-destructive">
                {errors.name}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={user.email} />
            <p className="text-sm text-muted-foreground">
              We send receipts to this address.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </section>

      <Separator />

      {/* Next section here: same two-column layout. */}
    </div>
  )
}
```

If `components/ui/field.tsx` exists (`Field`, `FieldLabel`, `FieldDescription`, `FieldError`), you can use it for the field groups. Keep the same layout.

## 9. Detail page

A main column and a narrow side column. The side column holds facts as a plain list (label on the left, value on the right).

```tsx
// app/invoices/[id]/page.tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"

// invoice and details come from your own code.
// details looks like: [["Issued", "12 Oct 2026"], ["Due", "11 Nov 2026"]]
export default function InvoicePage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title={`Invoice ${invoice.number}`}
        description={`Sent to ${invoice.customer}`}
        actions={
          <>
            <Button variant="outline">Download PDF</Button>
            <Button>Send reminder</Button>
          </>
        }
      />
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Line items</CardTitle>
            </CardHeader>
            <CardContent>{/* table of items */}</CardContent>
          </Card>
        </div>
        <aside className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y text-sm">
                {details.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
```

## 10. Landing page

Use this for a marketing home page. It is quiet on purpose. The boldness goes in two places only: the hero headline and one closing band in the accent color. Everything is left-aligned. The hero shows a real piece of the product, built from the same components, not a stock picture. Bands of `bg-muted/40` with a `border-y` separate the sections. No gradients, no small labels above headings, no emoji. Do not invent logos, numbers or testimonials. Replace the words with your own product's content. This page imports `StatusBadge` from pattern 4, so create that file first (or use a plain `<Badge>`).

```tsx
// app/(marketing)/page.tsx
import Link from "next/link"
import { Bell, Check, FileText, Link2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StatusBadge } from "@/components/status-badge"
import { cn } from "@/lib/utils"

const features = [
  {
    icon: FileText,
    title: "Start from what worked",
    description:
      "Copy a past invoice, change the amounts and dates, and send it in under a minute.",
  },
  {
    icon: Bell,
    title: "Reminders that do the chasing",
    description:
      "Friendly follow-ups go out before the due date and again when a payment is late.",
  },
  {
    icon: Link2,
    title: "One page for each client",
    description:
      "Clients see the work, the total and the due date. No attachments to hunt for.",
  },
]

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "For freelancers who send a few invoices a month.",
    features: ["Up to 5 invoices a month", "Unlimited clients", "PDF download"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Pro",
    price: "$12",
    description: "For freelancers who invoice every week.",
    features: [
      "Unlimited invoices",
      "Automatic reminders",
      "Your logo on every invoice",
      "CSV export",
    ],
    cta: "Choose Pro",
    featured: true,
  },
]

export default function Home() {
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="font-semibold tracking-tight">
            Ledgerly
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
            <Link href="#features" className="hover:text-foreground">
              Features
            </Link>
            <Link href="#pricing" className="hover:text-foreground">
              Pricing
            </Link>
          </nav>
          <Button>Start free</Button>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:px-8">
        <div className="space-y-6">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Send invoices and get paid in one place
          </h1>
          <p className="max-w-prose text-lg text-muted-foreground">
            One sentence about who it is for and what gets easier for them.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg">Start free</Button>
            <Button size="lg" variant="outline">
              See how it works
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            No credit card needed. The free plan stays free.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Invoice INV-1042
              <StatusBadge status="paid" />
            </CardTitle>
            <CardDescription>Northwind Traders, due 11 Nov 2026</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              <div className="flex justify-between py-3 first:pt-0">
                <dt className="text-muted-foreground">Brand identity, phase 1</dt>
                <dd className="tabular-nums">$2,400.00</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-muted-foreground">Revisions, 3 rounds</dt>
                <dd className="tabular-nums">$450.00</dd>
              </div>
              <div className="flex justify-between py-3 font-medium last:pb-0">
                <dt>Total</dt>
                <dd className="tabular-nums">$2,850.00</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </section>

      <section id="features" className="border-y bg-muted/40">
        <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-3xl font-semibold tracking-tight text-balance">
              Everything you need to get paid
            </h2>
            <p className="text-muted-foreground">
              One sentence that says what the next three things have in common.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <Card key={title}>
                <CardHeader>
                  <div className="mb-2 flex size-9 items-center justify-center rounded-md border bg-background">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section
        id="pricing"
        className="mx-auto w-full max-w-6xl space-y-10 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="max-w-2xl space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Simple pricing
          </h2>
          <p className="text-muted-foreground">
            Start free. Upgrade when you send more than the free plan allows.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:max-w-4xl">
          {plans.map((plan) => (
            <Card key={plan.name} className={cn(plan.featured && "border-primary")}>
              <CardHeader>
                <CardTitle className="flex h-6 items-center justify-between">
                  {plan.name}
                  {plan.featured ? <Badge>Most popular</Badge> : null}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-6">
                <p className="text-4xl font-semibold tracking-tight tabular-nums">
                  {plan.price}
                  <span className="ml-1 text-base font-normal text-muted-foreground">
                    / month
                  </span>
                </p>
                <ul className="flex-1 space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 text-muted-foreground" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.featured ? "default" : "outline"}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
        <div className="space-y-6 rounded-xl bg-primary px-6 py-12 text-primary-foreground sm:px-12">
          <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-balance">
            Send your first invoice today
          </h2>
          <p className="max-w-xl text-primary-foreground/90">
            It takes about a minute. The free plan has no time limit.
          </p>
          <Button size="lg" variant="secondary">
            Start free
          </Button>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© 2026 Ledgerly</p>
          <nav className="flex gap-6">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
```

Keep the pieces that make this page work: the muted bands with `border-y`, one `Card` style for everything, the neutral icon square, the single accent band at the end. In the pricing cards, `h-6` on the title and `flex-1` on the list keep the titles and buttons lined up when one plan has a badge or more features than the other. Text on the accent band must stay `text-primary-foreground` or `/90`. Lower opacity fails the contrast check.

## 11. Sign-in page

Best option: `npx shadcn@latest add login-04` and adapt it. If you write it yourself, use this. The app name goes in the card as plain text. No logo blob, no gradient background.

```tsx
// app/sign-in/page.tsx
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// signIn comes from your own code.
export default function SignInPage() {
  return (
    <main className="grid min-h-svh place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>Use your work email to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
```

---

## Charts, dialogs and toasts

- **Charts:** use the shadcn `chart` component (`npx shadcn@latest add chart`). Use only `--chart-1` to `--chart-5`. One chart per card, with a title and a one-line description. No gradient fills. Axis text is `text-xs text-muted-foreground`.
- **Dialogs:** for confirming a destructive action. Title says the action ("Delete invoice?"). Body says what happens. The red button repeats the action ("Delete invoice"). Cancel is `outline`.
- **Toasts:** use `sonner` for results of an action. Keep them short: "Invoice sent". Put errors next to the thing that failed when you can.
- **Tabs:** only for sections at the same level of one page. Not for navigation between pages.
