import {
  pgTable,
  text,
  timestamp,
  integer,
  unique,
} from "drizzle-orm/pg-core";

export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const employees = pgTable(
  "employees",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    empId: text("emp_id").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    mobile: text("mobile").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("employees_client_emp_id_unique").on(table.clientId, table.empId)],
);

export const batches = pgTable("batches", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  createdBy: text("created_by").notNull(),
  totalMatched: integer("total_matched").notNull().default(0),
  unmatchedEmployees: integer("unmatched_employees").notNull().default(0),
  unmatchedPdfs: integer("unmatched_pdfs").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per employee per batch — the unit of work the sender loop drains.
export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  batchId: text("batch_id").notNull().references(() => batches.id, { onDelete: "cascade" }),
  employeeId: text("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  blobPathname: text("blob_pathname").notNull(),
  blobUrl: text("blob_url").notNull(),
  originalFilename: text("original_filename").notNull(),
  // pending -> sending -> sent -> delivered -> read (or -> failed at any point)
  status: text("status").notNull().default("pending"),
  msg91MessageId: text("msg91_message_id"),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Raw MSG91 delivery-status webhook payloads. MSG91's exact callback schema
// hasn't been confirmed against a live event yet — logging the raw body lets
// us refine the parser in api/webhooks/msg91 without losing any events.
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  rawBody: text("raw_body").notNull(),
  matchedMessageId: text("matched_message_id"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

// Permanent, unguessable download links handed to MSG91/Meta so they can
// fetch the PDF over plain HTTPS without our app's auth. Security comes from
// the token being an unguessable 192-bit random value, not from expiry —
// MSG91/Meta can fetch and retry fetching the document well after the
// initial send (confirmed happening in production), so these must not
// expire or be single-use, or the document silently never attaches.
export const sendTokens = pgTable("send_tokens", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  fetchCount: integer("fetch_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
