// server/db/schema.ts
// ALL tables live in this one file (or in files next to it that this one re-exports).
// If your auth library creates the user table for you, do not define it again. Reference its id.
import { date, index, integer, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"

export const invoiceStatus = pgEnum("invoice_status", ["draft", "sent", "paid"])

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Every row that belongs to a user has an owner column. Every query filters on it.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    customerName: text("customer_name").notNull(),
    amountCents: integer("amount_cents").notNull(), // money is whole cents. Never a float.
    currency: text("currency").notNull().default("USD"),
    status: invoiceStatus("status").notNull().default("draft"),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // The database enforces the rule, so two requests at the same time cannot break it.
    unique("invoices_user_number_unique").on(t.userId, t.number),
    // Foreign keys are not indexed automatically in Postgres. This also serves the list query.
    index("invoices_user_created_idx").on(t.userId, t.createdAt),
  ],
)

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }), // keep payment history
    // The provider's event id. UNIQUE, so a retried webhook cannot be recorded twice.
    eventId: text("event_id").notNull().unique(),
    amountCents: integer("amount_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_invoice_idx").on(t.invoiceId)],
)
