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

// A "send" (internally still named batches) — one upload-and-send round for
// one company. `sequence` is a per-company auto-increment (Send #1, #2, ...)
// so two sends never need a unique name; `label` is purely an optional,
// non-unique description the admin can add for their own reference.
export const batches = pgTable("batches", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  label: text("label"),
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

// A WhatsApp-like conversation timeline per phone number — both what an
// employee sends us (inbound, webhook-only — there's no pull API for this)
// and what an admin replies with from the Inbox (outbound, free-form within
// WhatsApp's 24h session window, not a template send). Matched to an
// employee/company by normalized phone number when possible; unmatched
// senders still show up so nothing is silently dropped.
export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").references(() => employees.id, { onDelete: "set null" }),
  clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
  counterpartyNumber: text("counterparty_number").notNull(),
  direction: text("direction").notNull(), // 'inbound' | 'outbound'
  messageType: text("message_type").notNull().default("text"), // text | image | document | audio | video | location | unknown
  textBody: text("text_body"),
  mediaUrl: text("media_url"),
  mediaFilename: text("media_filename"),
  // Permanent, unguessable token for outbound attachments only — the public
  // URL MSG91/Meta fetches to deliver a reply attachment, same security
  // model as sendTokens (unguessable token, not expiry, is the boundary).
  attachmentToken: text("attachment_token").unique(),
  // Also has a partial unique index in the DB (WHERE msg91_message_id IS NOT
  // NULL) — created via raw SQL, not tracked here, so `db:push` doesn't try
  // to drop it. It's what makes the inbound webhook's dedupe insert atomic;
  // see api/webhooks/msg91/inbound for why a plain unique() isn't used
  // (multiple NULLs must stay allowed for outbound rows without an id yet).
  msg91MessageId: text("msg91_message_id"),
  status: text("status").notNull().default("received"), // received | sent | delivered | read | failed
  error: text("error"),
  rawPayload: text("raw_payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Tracks when an admin last opened each conversation, so the Inbox can show
// an unread count/badge. Shared across all admins (not per-user) — matches
// the email-allowlist model where anyone authorized can handle any chat, and
// avoids building a per-user read model nobody asked for.
export const inboxReadState = pgTable("inbox_read_state", {
  counterpartyNumber: text("counterparty_number").primaryKey(),
  lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }).notNull().defaultNow(),
});

// Single-row throttle so the (slow, external) MSG91 log sync doesn't run on
// every 5-second dashboard poll — only after enough time has passed.
export const syncState = pgTable("sync_state", {
  id: text("id").primaryKey(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
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
