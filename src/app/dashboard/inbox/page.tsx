"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Paperclip, Send, MessageCircle, FileText, Download, Building2, Check, CheckCheck, Clock, AlertCircle, Loader2, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyAvatar } from "@/components/company-avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, timeAgo } from "@/lib/utils";

interface Conversation {
  counterparty_number: string;
  last_text: string | null;
  last_media_filename: string | null;
  last_direction: string;
  last_message_type: string;
  last_at: string;
  first_name: string | null;
  last_name: string | null;
  emp_id: string | null;
  company_name: string | null;
  unread_count: string | number;
}

interface ThreadMessage {
  id: string;
  direction: "inbound" | "outbound";
  messageType: string;
  textBody: string | null;
  mediaFilename: string | null;
  attachmentToken: string | null;
  status: string;
  error: string | null;
  createdAt: string;
}

interface ThreadIdentity {
  firstName: string | null;
  lastName: string | null;
  empId: string | null;
  companyName: string | null;
}

interface ThreadResponse {
  number: string;
  identity: ThreadIdentity | null;
  messages: ThreadMessage[];
}

function conversationName(c: Conversation): string {
  if (c.first_name) return `${c.first_name} ${c.last_name ?? ""}`.trim();
  return c.counterparty_number;
}

function identityName(identity: ThreadIdentity | null, fallback: string): string {
  if (identity?.firstName) return `${identity.firstName} ${identity.lastName ?? ""}`.trim();
  return fallback;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

function MessageStatusIcon({ status }: { status: string }) {
  const icon =
    status === "read" ? (
      <CheckCheck className="size-3.5 text-sky-300" />
    ) : status === "delivered" ? (
      <CheckCheck className="size-3.5 opacity-80" />
    ) : status === "sent" ? (
      <Check className="size-3.5 opacity-80" />
    ) : status === "failed" ? (
      <AlertCircle className="size-3.5 text-destructive" />
    ) : (
      <Clock className="size-3.5 opacity-70" />
    );
  const label =
    status === "read"
      ? "Read"
      : status === "delivered"
        ? "Delivered"
        : status === "sent"
          ? "Sent"
          : status === "failed"
            ? "Failed"
            : "Sending";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{icon}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadResponse | null>(null);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const res = await fetch("/api/inbox");
      if (!cancelled && res.ok) {
        const data = await res.json();
        setConversations(data.conversations);
      }
    }
    tick();
    const interval = setInterval(tick, 6000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    async function tick() {
      const res = await fetch(`/api/inbox/${selected}`);
      if (!cancelled && res.ok) setThread(await res.json());
    }
    tick();
    const interval = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

  async function handleSend() {
    if (!selected || (!draft.trim() && !file)) return;
    setSending(true);
    try {
      const formData = new FormData();
      if (draft.trim()) formData.append("text", draft.trim());
      if (file) formData.append("file", file);
      const res = await fetch(`/api/inbox/${selected}/reply`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Couldn't send — they may be outside the 24-hour reply window");
        return;
      }
      setDraft("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      const threadRes = await fetch(`/api/inbox/${selected}`);
      if (threadRes.ok) setThread(await threadRes.json());
    } finally {
      setSending(false);
    }
  }

  function selectConversation(number: string) {
    setSelected(number);
    // Optimistically clear the unread badge — the GET to /api/inbox/[number]
    // that follows marks it read server-side; this just avoids a flash of
    // stale state until the next inbox-list poll picks it up.
    setConversations((prev) => (prev ? prev.map((c) => (c.counterparty_number === number ? { ...c, unread_count: 0 } : c)) : prev));
  }

  const selectedConversation = conversations?.find((c) => c.counterparty_number === selected);

  let lastDay: string | null = null;

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-6xl overflow-hidden border-x shadow-lg">
      <div className="flex min-h-0 w-80 shrink-0 flex-col border-r bg-card">
        <div className="border-b px-4 py-3">
          <h1 className="text-lg font-semibold">Inbox</h1>
          <p className="text-xs text-muted-foreground">Replies from employees, across every company</p>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          {conversations === null ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-sm text-muted-foreground">
              <MessageCircle className="size-6" />
              No messages yet — when employees reply, they&apos;ll show up here.
            </div>
          ) : (
            conversations.map((c) => {
              const unread = Number(c.unread_count) > 0;
              return (
                <button
                  key={c.counterparty_number}
                  onClick={() => selectConversation(c.counterparty_number)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-l-4 border-l-transparent px-4 py-3 text-left transition-colors",
                    unread ? "border-l-chat bg-chat/10 hover:bg-chat/15" : "hover:bg-muted",
                    selected === c.counterparty_number && "bg-muted",
                  )}
                >
                  <div className={cn(!unread && "opacity-60")}>
                    <CompanyAvatar name={conversationName(c)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("flex min-w-0 items-center gap-1.5 truncate text-sm", unread ? "font-bold text-foreground" : "font-normal text-muted-foreground")}>
                        {unread && <span className="size-2.5 shrink-0 rounded-full bg-chat" />}
                        <span className="truncate">{conversationName(c)}</span>
                      </span>
                      <span className={cn("shrink-0 text-[11px]", unread ? "font-bold text-chat" : "text-muted-foreground")}>
                        {timeAgo(c.last_at)}
                      </span>
                    </div>
                    {c.company_name && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Building2 className="size-3" />
                        {c.company_name}
                        {c.emp_id && <span className="text-muted-foreground/70">· {c.emp_id}</span>}
                      </span>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-xs", unread ? "font-semibold text-foreground" : "text-muted-foreground")}>
                        {c.last_direction === "outbound" ? "You: " : ""}
                        {c.last_text ?? (c.last_media_filename ? `📎 ${c.last_media_filename}` : "…")}
                      </span>
                      {unread && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-chat px-1 text-[11px] font-bold text-chat-foreground">
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </ScrollArea>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <MessageCircle className="size-8" />
            Select a conversation to view messages
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b bg-card px-4 py-3">
              <CompanyAvatar
                name={thread?.identity ? identityName(thread.identity, selected) : selectedConversation ? conversationName(selectedConversation) : selected}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">
                    {thread?.identity ? identityName(thread.identity, selected) : selectedConversation ? conversationName(selectedConversation) : selected}
                  </span>
                  {thread?.identity?.firstName && <BadgeCheck className="size-3.5 shrink-0 text-chat" />}
                  {thread && !thread.identity && (
                    <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                      Unmatched
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <span className="shrink-0">{selected}</span>
                  {thread?.identity?.companyName && (
                    <>
                      <span className="shrink-0">·</span>
                      <Building2 className="size-3 shrink-0" />
                      <span className="truncate">{thread.identity.companyName}</span>
                    </>
                  )}
                  {thread?.identity?.empId && (
                    <>
                      <span className="shrink-0">·</span>
                      <span className="shrink-0">ID {thread.identity.empId}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <ScrollArea
              className="min-h-0 flex-1 px-4 py-4"
              style={{
                backgroundImage:
                  "radial-gradient(color-mix(in oklch, var(--foreground) 6%, transparent) 1px, transparent 1px)",
                backgroundSize: "18px 18px",
              }}
            >
              <div className="flex flex-col gap-1">
                {thread?.number !== selected && (
                  <div className="flex flex-col gap-2 pt-2">
                    <Skeleton className="ml-auto h-9 w-1/2 rounded-2xl" />
                    <Skeleton className="h-9 w-2/3 rounded-2xl" />
                    <Skeleton className="ml-auto h-9 w-1/3 rounded-2xl" />
                  </div>
                )}
                {thread?.number === selected && thread.messages.map((m, i) => {
                  const showDivider = dayLabel(m.createdAt) !== lastDay;
                  lastDay = dayLabel(m.createdAt);
                  const prev = thread.messages[i - 1];
                  const grouped = !showDivider && prev && prev.direction === m.direction;
                  return (
                    <div key={m.id}>
                      {showDivider && (
                        <div className="my-3 flex justify-center">
                          <span className="rounded-full bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
                            {dayLabel(m.createdAt)}
                          </span>
                        </div>
                      )}
                      <div className={cn("flex", m.direction === "outbound" ? "justify-end" : "justify-start", grouped ? "mt-0.5" : "mt-2")}>
                        <div
                          className={cn(
                            "max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                            m.direction === "outbound"
                              ? "bg-chat text-chat-foreground rounded-br-md"
                              : "border bg-card text-foreground rounded-bl-md",
                          )}
                        >
                          {m.textBody && <p className="whitespace-pre-wrap">{m.textBody}</p>}
                          {m.mediaFilename && (
                            <a
                              href={m.attachmentToken ? `/api/chat-attachments/${m.attachmentToken}` : undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "mt-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs underline",
                                m.direction === "outbound" ? "bg-background/20" : "bg-muted",
                              )}
                            >
                              <FileText className="size-3.5" />
                              {m.mediaFilename}
                              <Download className="size-3" />
                            </a>
                          )}
                          <div
                            className={cn(
                              "mt-1 flex items-center justify-end gap-1 text-[10px]",
                              m.direction === "outbound" ? "opacity-80" : "text-muted-foreground",
                            )}
                          >
                            {new Date(m.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                            {m.direction === "outbound" && <MessageStatusIcon status={m.status} />}
                          </div>
                          {m.error && <p className="mt-1 text-[10px] text-destructive">{m.error}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <div className="border-t bg-card p-3">
              {file && (
                <div className="mb-2 flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
                  <Paperclip className="size-3.5" />
                  {file.name}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setFile(null)}
                        className="ml-auto text-muted-foreground hover:text-foreground"
                        aria-label="Remove attachment"
                      >
                        ✕
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Remove attachment</TooltipContent>
                  </Tooltip>
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon-lg" onClick={() => fileInputRef.current?.click()}>
                      <Paperclip className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Attach a file</TooltipContent>
                </Tooltip>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message…"
                  className="min-h-9 flex-1 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon-lg"
                      onClick={handleSend}
                      disabled={sending || (!draft.trim() && !file)}
                      className="bg-chat text-chat-foreground hover:bg-chat/90"
                    >
                      {sending ? <Loader2 className="animate-spin" /> : <Send />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Send message</TooltipContent>
                </Tooltip>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Replies only deliver within 24 hours of the employee&apos;s last message — WhatsApp&apos;s own rule,
                not ours.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
