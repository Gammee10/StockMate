// server/db/schema.ts
// ALL tables live in this one file (or in files next to it that this one re-exports).
// If your auth library creates the user table for you, do not define it again. Reference its id.
// drizzle-kit loads this file. Do not import "server-only" modules here.
//
// Rules for every table:
//   - A row that belongs to a user has an owner column (userId). Every query filters on it.
//   - Money is whole cents (an integer). Never a float.
//   - Index every foreign key and every column a list is filtered or sorted by.
//   - A rule the database can enforce is a constraint: unique, foreign key, not null.
// A complete schema is in examples/invoices/server/db/schema.ts.
//
// import { index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"

export {}
